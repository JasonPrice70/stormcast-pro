"""
Lambda function that fetches ECMWF Open Data's ensemble (EPS) tropical cyclone
track BUFR product and decodes it into the same track shape used elsewhere in
this app for A-deck model tracks: { modelId, points: [{ tau, lat, lon, vmax }] }.

Not exposed via API Gateway directly - invoked by the nhcProxy Lambda's
'ecmwf-ensemble' route via Lambda.invoke().

Data source: s3://ecmwf-forecasts (ECMWF Open Data, public, unsigned requests),
stream=enfo, type=tf ("tropical cyclone track"). One BUFR file per forecast
cycle contains every active storm worldwide (control + 50 perturbed members),
so we always download the whole file and filter to the requested storm by
name - ECMWF's own storm identifiers (e.g. "01C") don't line up with NHC's
ATCF storm IDs.
"""
import json
import os
from datetime import datetime, timedelta, timezone

import boto3
from botocore import UNSIGNED
from botocore.config import Config
import pdbufr

S3_BUCKET = 'ecmwf-forecasts'
TMP_BUFR_PATH = '/tmp/ecmwf_tf.bufr'
MS_TO_KT = 1.94384

# meteorologicalAttributeSignificance code (WMO 008005) used by ECMWF's TC
# track BUFR product for "position of the centre of the tropical cyclone" at
# each forecast step, as opposed to the co-located "position of the 10m wind
# speed maximum" also present in the message. Verified empirically against a
# real cycle: this is the value that produces a smooth, physically continuous
# track (see index.js history/PR notes for how this was confirmed).
STORM_CENTRE_SIGNIFICANCE = 3

s3 = boto3.client('s3', config=Config(signature_version=UNSIGNED))

# Module-level cache: persists across warm Lambda invocations, avoids
# re-downloading the ~2MB BUFR file on every request within the same cycle.
_cache = {'key': None, 'bytes': None}


def _candidate_cycles(now=None):
    """Most-recent-first list of synoptic cycle datetimes to try, walking
    back far enough to cover ECMWF's typical publication delay (~7-9h)."""
    now = now or datetime.now(timezone.utc)
    cycles = []
    day_cursor = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for day_offset in range(0, 3):
        d = day_cursor - timedelta(days=day_offset)
        for hour in (18, 12, 6, 0):
            candidate = d.replace(hour=hour)
            if candidate <= now:
                cycles.append(candidate)
    return cycles[:10]


def _step_for_cycle(cycle_dt):
    # ENS tropical cyclone tracks are published once per cycle at the run's
    # final step: 360h for 00/12z cycles, 144h for 06/18z cycles (verified
    # against the live bucket listing - ECMWF has changed this before and may
    # again, so this is the one thing to re-check first if lookups start
    # failing).
    return 360 if cycle_dt.hour in (0, 12) else 144


def _s3_key(cycle_dt):
    step = _step_for_cycle(cycle_dt)
    date_str = cycle_dt.strftime('%Y%m%d')
    hour_str = cycle_dt.strftime('%H')
    ts = cycle_dt.strftime('%Y%m%d%H%M%S')
    return f'{date_str}/{hour_str}z/ifs/0p25/enfo/{ts}-{step}h-enfo-tf.bufr'


def _fetch_latest_bufr():
    """Return (bytes, cycle_dt, key) for the most recent published cycle."""
    for cycle_dt in _candidate_cycles():
        key = _s3_key(cycle_dt)
        if _cache['key'] == key:
            return _cache['bytes'], cycle_dt, key
        try:
            obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        except s3.exceptions.NoSuchKey:
            continue
        except Exception as e:
            if getattr(e, 'response', {}).get('Error', {}).get('Code') in ('NoSuchKey', '404'):
                continue
            raise
        body = obj['Body'].read()
        _cache['key'] = key
        _cache['bytes'] = body
        return body, cycle_dt, key
    return None, None, None


def _parse_storm(bufr_bytes, storm_name):
    with open(TMP_BUFR_PATH, 'wb') as f:
        f.write(bufr_bytes)

    names_df = pdbufr.read_bufr(TMP_BUFR_PATH, columns=('stormIdentifier', 'longStormName'))
    if names_df.empty:
        return None
    names_df['longStormName'] = names_df['longStormName'].astype(str).str.strip()
    target = storm_name.strip().upper()
    match = names_df[names_df['longStormName'].str.upper() == target]
    if match.empty:
        # Fall back to a loose contains-match in case of trailing basin suffixes etc.
        match = names_df[names_df['longStormName'].str.upper().str.contains(target, na=False)]
    if match.empty:
        return None
    storm_id = match.iloc[0]['stormIdentifier']

    pos_df = pdbufr.read_bufr(
        TMP_BUFR_PATH,
        columns=('stormIdentifier', 'ensembleMemberNumber', 'ensembleForecastType',
                 'timePeriod', 'meteorologicalAttributeSignificance', 'latitude', 'longitude'),
        filters={'stormIdentifier': storm_id, 'meteorologicalAttributeSignificance': STORM_CENTRE_SIGNIFICANCE},
    )
    if pos_df.empty:
        return None

    wind_df = pdbufr.read_bufr(
        TMP_BUFR_PATH,
        columns=('stormIdentifier', 'ensembleMemberNumber', 'timePeriod', 'windSpeedAt10M'),
        filters={'stormIdentifier': storm_id},
    )

    merged = pos_df.merge(
        wind_df, on=['stormIdentifier', 'ensembleMemberNumber', 'timePeriod'], how='left'
    )

    tracks = []
    models_present = []
    for member, group in merged.groupby('ensembleMemberNumber'):
        forecast_type = group['ensembleForecastType'].iloc[0]
        model_id = 'EPSCTRL' if forecast_type == 0 else f'EPS{int(member):02d}'

        points = []
        for _, row in group.sort_values('timePeriod').iterrows():
            lat, lon = row['latitude'], row['longitude']
            if lat != lat or lon != lon:  # NaN once a member's cyclone dissipates
                continue
            vmax = row.get('windSpeedAt10M')
            vmax_kt = round(float(vmax) * MS_TO_KT) if vmax == vmax else None
            points.append({
                'tau': int(row['timePeriod']),
                'lat': float(lat),
                'lon': float(lon),
                'vmax': vmax_kt,
            })

        if points:
            tracks.append({'modelId': model_id, 'points': points})
            models_present.append(model_id)

    # Control run first, then perturbations in member-number order
    def priority(model_id):
        return -1 if model_id == 'EPSCTRL' else int(model_id.replace('EPS', ''))
    tracks.sort(key=lambda t: priority(t['modelId']))
    models_present.sort(key=priority)

    return {'modelsPresent': models_present, 'tracks': tracks}


def handler(event, context):
    storm_name = (event or {}).get('stormName')
    if not storm_name:
        return {'error': 'stormName is required', 'modelsPresent': [], 'tracks': []}

    bufr_bytes, cycle_dt, key = _fetch_latest_bufr()
    if bufr_bytes is None:
        return {'filename': None, 'modelsPresent': [], 'tracks': []}

    cycle_time = cycle_dt.strftime('%Y%m%d%H')

    try:
        result = _parse_storm(bufr_bytes, storm_name)
    except Exception as e:
        return {'error': str(e), 'filename': key, 'modelsPresent': [], 'tracks': [], 'cycleTime': cycle_time}

    if result is None:
        return {'filename': key, 'modelsPresent': [], 'tracks': [], 'cycleTime': cycle_time}

    return {
        'filename': key,
        'modelsPresent': result['modelsPresent'],
        'tracks': result['tracks'],
        'cycleTime': cycle_time,
    }

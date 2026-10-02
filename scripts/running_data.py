#!/usr/bin/env python3
"""Build site/assets/js/running-data.js from a list of runs.

Input is a JSON file (kept OUTSIDE the repo) shaped like:
  [{"date": "2026-10-01", "indoor": false, "seconds": 1838, "km": 3.29}, ...]
Only aggregates are written to the output. No coordinates, workout titles, heart rate,
calories or per-run dates ever reach the repo.

Usage: python3 scripts/running_data.py RUNS.json [--as-of YYYY-MM-DD]
"""
import argparse, datetime, json, pathlib

MI = 0.621371
OUT = pathlib.Path(__file__).resolve().parent.parent / "site" / "assets" / "js" / "running-data.js"
BUCKETS = [("Under 2", 0, 2), ("2 to 3", 2, 3), ("3 to 4", 3, 4), ("4+", 4, 99)]


def build(runs, as_of):
    rs = [(datetime.date.fromisoformat(r["date"]), bool(r["indoor"]), int(r["seconds"]), float(r["km"])) for r in runs]
    rs = [r for r in rs if r[0] <= as_of]
    year = [r for r in rs if r[0].year == as_of.year]
    last28 = [r for r in rs if as_of - datetime.timedelta(days=27) <= r[0] <= as_of]

    monday = as_of - datetime.timedelta(days=as_of.weekday())
    weeks = []
    for k in range(11, -1, -1):
        start = monday - datetime.timedelta(weeks=k)
        wk = [r for r in rs if start <= r[0] <= start + datetime.timedelta(days=6)]
        weeks.append({"start": start.isoformat(), "miles": round(sum(r[3] for r in wk) * MI, 2), "runs": len(wk)})

    win = [r for r in rs if r[0] >= monday - datetime.timedelta(weeks=11)]
    mix = {}
    for name, indoor in (("outdoor", False), ("indoor", True)):
        xs = [r for r in win if r[1] == indoor]
        mix[name] = {"runs": len(xs), "miles": round(sum(r[3] for r in xs) * MI, 1)}
    lengths = [{"label": n, "runs": sum(1 for r in win if lo <= r[3] * MI < hi)} for n, lo, hi in BUCKETS]

    return {
        "asOf": as_of.isoformat(),
        "source": "COROS",
        "last28": {
            "miles": round(sum(r[3] for r in last28) * MI, 1),
            "runs": len(last28),
            "hours": round(sum(r[2] for r in last28) / 3600, 1),
            "longestMiles": round(max((r[3] for r in last28), default=0) * MI, 1),
        },
        "year": {"year": as_of.year, "miles": round(sum(r[3] for r in year) * MI, 1), "runs": len(year)},
        "weeks": weeks,
        "mix": mix,
        "lengths": lengths,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", help="JSON file of runs (outside the repo)")
    ap.add_argument("--as-of", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    data = build(json.load(open(a.runs)), datetime.date.fromisoformat(a.as_of))
    OUT.write_text("// Recent running stats (aggregate snapshot). Contains no routes, locations, heart-rate or per-run data.\n"
                   "export const RUNNING = " + json.dumps(data, indent=2) + ";\n")
    print(f"wrote {OUT.relative_to(OUT.parents[3])}: {data['year']['miles']} mi YTD, {data['last28']['miles']} mi last 28 days")

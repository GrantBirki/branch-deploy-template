### deployment result: {{ status }}

**{{ actor }}** ran {{ "a noop for" if noop else "a deploy for" }} `{{ ref }}` in **{{ environment }}**.

- commit: `{{ sha }}`
- finished: {{ deployment_end_time }}
- [workflow logs]({{ logs }})

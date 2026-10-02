"""Lock only transitive serving dependencies; exclude training tooling from Render."""
from importlib import metadata
from pathlib import Path
from packaging.requirements import Requirement
from packaging.markers import default_environment

roots = [line.strip() for line in Path("requirements.txt").read_text().splitlines()
         if line.strip() and not line.startswith("#")]
pending = [Requirement(line).name for line in roots]
seen = {}
environment = default_environment()
environment["extra"] = ""
while pending:
    distribution = metadata.distribution(pending.pop())
    name = distribution.metadata["Name"]
    if name.lower() in seen:
        continue
    seen[name.lower()] = f"{name}=={distribution.version}"
    for dependency in distribution.requires or []:
        requirement = Requirement(dependency)
        if requirement.marker is None or requirement.marker.evaluate(environment):
            pending.append(requirement.name)
# Windows-only uvicorn colorama is harmless on Linux. Linux runtime extras are not enabled.
Path("requirements.lock.txt").write_text("\n".join(sorted(seen.values())) + "\n", encoding="utf-8")

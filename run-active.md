[meta]
timestamp: 2026-01-19T00:00:00Z
agent: schema-evolution-agent
stage: 050-implement
prompt_ref: docs/DATABASE_SETUP.md

[summary]
Updated Postgres healthcheck to use configured environment variables and added a troubleshooting subsection for the "FATAL: database \"elfman\" does not exist" case including safe commands to create the missing DB with the correct collation and migration steps.

[artifacts]
- c:\Users\pwalc\MyApps\paperless-ai\docker-compose.yml (healthcheck now uses ${POSTGRES_USER} & ${POSTGRES_DB})
- c:\Users\pwalc\MyApps\paperless-ai\docs\DATABASE_SETUP.md (new subsection: missing DB / collation; commands and warnings)
- consulted: c:\Users\pwalc\MyApps\paperless-ai\.env, c:\Users\pwalc\MyApps\paperless-ai\docker-compose.env

[next]
- (To do) Operator: run the verification commands below on the host to confirm state and create the missing DB if required.
- (Optional) If operator intends to change DB name cluster-wide, plan downtime and backup before re-initializing the `pgdata` volume.

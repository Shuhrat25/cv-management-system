{
    "name": "TalentPulse Aggregate Connector",
    "version": "19.0.1.0.0",
    "summary": "Manually fetch position summary and aggregates from TalentPulse",
    "category": "Human Resources",
    "author": "Shuhrat Abdurahmonov",
    "license": "LGPL-3",
    "depends": ["base"],
    "data": [
        "security/ir.model.access.csv",
        "views/connection_views.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}

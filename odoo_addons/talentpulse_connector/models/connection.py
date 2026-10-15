import json

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError

from ..client import ConnectorError, fetch_aggregates, validate_configuration


class TalentPulseConnection(models.Model):
    _name = "talentpulse.connection"
    _description = "TalentPulse position aggregate connection"
    _order = "name, id"

    name = fields.Char(required=True)
    base_url = fields.Char(
        string="TalentPulse backend origin", required=True,
        help="Public HTTPS backend origin, for example https://your-backend.example.com.",
    )
    position_token = fields.Char(
        string="Position API token", required=True, copy=False,
        groups="base.group_system",
        help="Private position UUID token. Masked in the form; stored in the Odoo database.",
    )
    position_id = fields.Char(readonly=True, copy=False)
    position_title = fields.Char(readonly=True, copy=False)
    position_description = fields.Text(readonly=True, copy=False)
    submitted_cv_count = fields.Integer(string="Published CVs", readonly=True, copy=False)
    aggregate_json = fields.Text(string="Aggregate statistics (JSON)", readonly=True, copy=False)
    last_fetched_at = fields.Datetime(readonly=True, copy=False)

    @api.constrains("base_url", "position_token")
    def _validate_connection(self):
        for record in self:
            try:
                validate_configuration(record.base_url, record.position_token)
            except ConnectorError as error:
                raise ValidationError(str(error)) from None

    def action_fetch_aggregates(self):
        self.ensure_one()
        # A hidden button alone is not access control; public RPC methods must
        # check permissions before making network calls or reading the token.
        if not self.env.user.has_group("base.group_system"):
            raise AccessError("Only Odoo Settings administrators can fetch TalentPulse data.")
        self.check_access("write")
        try:
            payload = fetch_aggregates(self.base_url, self.position_token)
        except ConnectorError as error:
            raise UserError(str(error)) from None
        position = payload["position"]
        self.write({
            "position_id": position["id"],
            "position_title": position["title"],
            "position_description": position["description"],
            "submitted_cv_count": position["totalSubmittedCVs"],
            "aggregate_json": json.dumps(payload["aggregatedResults"], ensure_ascii=False, indent=2),
            "last_fetched_at": fields.Datetime.now(),
        })
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": "TalentPulse",
                "message": "Position summary and aggregate statistics updated.",
                "type": "success",
                "sticky": False,
            },
        }

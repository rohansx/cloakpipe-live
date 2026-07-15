// Cedar policy set for the health-intake scenario. Sensitive-category data is
// tokenized before it reaches the triage/routing endpoint; secret exfiltration
// and non-allowlisted destinations are hard-blocked (shared with fintech).

@id("health.phi.tokenize")
permit (
  principal,
  action == Action::"egress",
  resource
)
when {
  resource.destination in [Destination::"crm_lookup", Destination::"http_post"] &&
  context.pii_detected == true
}
advice {
  transform: "tokenize"   // name, DOB, insurance id, phone -> stable tokens
};

@id("secret.exfil.block")
forbid (
  principal,
  action == Action::"egress",
  resource
)
when {
  context.secret_detected == true
};

@id("egress.destination.allowlist")
forbid (
  principal,
  action == Action::"egress",
  resource
)
unless {
  resource.destination in [Destination::"crm_lookup", Destination::"send_email", Destination::"http_post"] &&
  resource.host in ["audit.internal", "triage.internal", "localhost", "127.0.0.1"]
};

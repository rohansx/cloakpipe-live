// Cedar policy set for the fintech scenario.
//
// These files are the human-readable, authoritative statement of egress intent.
// The runtime engine in src/cloakpipe/policy.ts mirrors them (a full Cedar
// evaluator is out of scope for the demo). policy_id values in the ledger map
// 1:1 to the @id annotations below.

// Tokenize PII before it egresses to any allowlisted destination.
@id("fintech.pii.tokenize")
permit (
  principal,
  action == Action::"egress",
  resource
)
when {
  resource.destination in [Destination::"crm_lookup", Destination::"send_email", Destination::"http_post"] &&
  context.pii_detected == true
}
advice {
  transform: "tokenize"   // PAN, Aadhaar, card, email, phone, name -> stable tokens
};

// Hard-block any egress that carries a secret / API key.
@id("secret.exfil.block")
forbid (
  principal,
  action == Action::"egress",
  resource
)
when {
  context.secret_detected == true
};

// Hard-block destinations / hosts not on the allowlist.
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

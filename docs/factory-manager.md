# Factory Manager

Factory Manager provides agent-assisted routing and operational help for Factory
lines. It is available to every Islo tenant.

## Member controls

Factory Manager is controlled per member. Enabling it activates Manager behavior
for your account in the current tenant, while disabling it opts only your account
out. Other members keep their own setting.

```bash
islo factory manager status
islo factory manager enable
islo factory manager disable
```

Use `status` after switching tenants to confirm your current member setting in
that tenant.

## Runtime identity

Internal runtime and session names may include a V1 suffix. Those names identify
the Manager runtime or session protocol; they do not limit tenant availability.

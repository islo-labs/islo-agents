# `qa` snapshot source

Copy into a build VM per `../README.md`, then capture as snapshot `qa`:

```bash
islo snapshot save <your-build-sandbox> --name qa
```

The snapshot holds a minimal Playwright workspace and `stage.py`. No OTP/login harness — provision-mode sandboxes tear down when the run finishes.

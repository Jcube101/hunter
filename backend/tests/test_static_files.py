"""D12 (Session 17 audit): the StaticFiles-mounted-last invariant.

Mounting StaticFiles before the API routes would let it intercept /api/* and
return 404s instead of reaching the real handlers (see SPEC.md / CLAUDE.md).
This is tested by pointing HUNTER_DIST_DIR at a throwaway fixture directory
(never the real frontend/dist/) and reloading `main` so its module-level
`if os.path.isdir(DIST_DIR): app.mount(...)` re-evaluates against it, then
inspecting the registered route order directly.

Run:  cd backend && .venv/bin/python -m pytest -q
"""

import importlib
import os

from starlette.routing import Mount

import main as main_module


def _reload_with_dist_dir(dist_dir):
    """Reload `main` with HUNTER_DIST_DIR set (or unset if dist_dir is None)."""
    if dist_dir is None:
        os.environ.pop("HUNTER_DIST_DIR", None)
    else:
        os.environ["HUNTER_DIST_DIR"] = str(dist_dir)
    importlib.reload(main_module)


def test_api_routes_registered_before_the_staticfiles_mount(tmp_path):
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<html><body>fixture</body></html>")

    try:
        _reload_with_dist_dir(dist_dir)
        routes = main_module.app.routes
        api_indices = [i for i, r in enumerate(routes) if getattr(r, "path", "").startswith("/api")]
        mount_indices = [i for i, r in enumerate(routes) if isinstance(r, Mount)]

        assert api_indices, "expected /api/* routes to be registered"
        assert mount_indices, "expected the StaticFiles mount to be registered (fixture dist/ present)"
        assert max(api_indices) < min(mount_indices), (
            "StaticFiles must be mounted AFTER all /api/* routes, or it will "
            "intercept API calls and return 404s"
        )
    finally:
        _reload_with_dist_dir(None)  # restore the real (env-default) DIST_DIR for later tests


def test_no_mount_registered_when_dist_dir_is_absent(tmp_path):
    missing_dir = tmp_path / "does-not-exist"

    try:
        _reload_with_dist_dir(missing_dir)
        routes = main_module.app.routes
        mount_indices = [i for i, r in enumerate(routes) if isinstance(r, Mount)]
        api_indices = [i for i, r in enumerate(routes) if getattr(r, "path", "").startswith("/api")]

        assert not mount_indices, "no StaticFiles mount should exist when dist/ is absent (dev mode)"
        assert api_indices, "/api/* routes must still be registered without a dist/ build"
    finally:
        _reload_with_dist_dir(None)

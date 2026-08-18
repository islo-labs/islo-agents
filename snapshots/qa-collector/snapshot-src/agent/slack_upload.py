#!/usr/bin/env python3
"""Slack helpers for Islo QA staging and collector notifications."""

from __future__ import annotations

import json
import mimetypes
import os
import urllib.parse
import urllib.request

API = "https://slack.com/api"
DEFAULT_TIMEOUT = 300


class SlackError(RuntimeError):
    def __init__(self, method: str, resp: dict):
        self.method = method
        self.resp = resp
        super().__init__(f"{method} failed: {json.dumps(resp)[:400]}")


def _token() -> str:
    token = (os.environ.get("SLACK_TOKEN") or "").strip()
    if not token:
        raise SlackError("token", {"error": "SLACK_TOKEN is not set"})
    return token


def call(method: str, params: dict, token: str | None = None, *, timeout: int = DEFAULT_TIMEOUT) -> dict:
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(
        f"{API}/{method}",
        data=data,
        headers={
            "Authorization": f"Bearer {token or _token()}",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.load(resp)
    if not payload.get("ok"):
        raise SlackError(method, payload)
    return payload


def post_message(
    channel_id: str,
    text: str,
    *,
    thread_ts: str | None = None,
    token: str | None = None,
) -> dict:
    params: dict[str, str] = {
        "channel": channel_id,
        "text": text,
        "mrkdwn": "true",
        "unfurl_links": "false",
        "unfurl_media": "false",
    }
    if thread_ts:
        params["thread_ts"] = thread_ts
    return call("chat.postMessage", params, token)


def _first_file(payload: dict) -> dict:
    files = payload.get("files") or []
    if not files:
        raise SlackError("files.completeUploadExternal", {"error": "no files returned"})
    return files[0]


def _put_upload_url(upload_url: str, content: bytes) -> None:
    upload_req = urllib.request.Request(
        upload_url,
        data=content,
        headers={"Content-Type": "application/octet-stream"},
        method="POST",
    )
    with urllib.request.urlopen(upload_req, timeout=DEFAULT_TIMEOUT):
        pass


def upload_bytes(
    filename: str,
    content: bytes,
    *,
    title: str | None = None,
    channel_id: str | None = None,
    thread_ts: str | None = None,
    initial_comment: str | None = None,
    token: str | None = None,
) -> dict:
    upload = call(
        "files.getUploadURLExternal",
        {"filename": filename, "length": str(len(content))},
        token,
    )
    _put_upload_url(upload["upload_url"], content)
    complete: dict[str, str] = {
        "files": json.dumps([{"id": upload["file_id"], "title": title or filename}]),
    }
    if channel_id:
        complete["channel_id"] = channel_id
    if thread_ts:
        complete["thread_ts"] = thread_ts
    if initial_comment:
        complete["initial_comment"] = initial_comment
    return _first_file(call("files.completeUploadExternal", complete, token))


def upload_file(
    path: str,
    *,
    title: str | None = None,
    channel_id: str | None = None,
    thread_ts: str | None = None,
    initial_comment: str | None = None,
    token: str | None = None,
) -> dict:
    with open(path, "rb") as fh:
        content = fh.read()
    filename = os.path.basename(path)
    mime, _ = mimetypes.guess_type(filename)
    if mime and mime.startswith("video/"):
        if not filename.lower().endswith(".webm"):
            filename = f"{os.path.splitext(filename)[0]}.webm"
    return upload_bytes(
        filename,
        content,
        title=title or os.path.basename(path),
        channel_id=channel_id,
        thread_ts=thread_ts,
        initial_comment=initial_comment,
        token=token,
    )


def file_info(file_id: str, token: str | None = None) -> dict:
    payload = call("files.info", {"file": file_id}, token)
    file_obj = payload.get("file")
    if not isinstance(file_obj, dict):
        raise SlackError("files.info", {"error": "missing file object"})
    return file_obj


def download_file(file_id: str, token: str | None = None) -> tuple[bytes, str]:
    info = file_info(file_id, token)
    url = info.get("url_private_download") or info.get("url_private")
    if not url:
        raise SlackError("files.info", {"error": "file has no private download URL"})
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token or _token()}"},
    )
    with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
        content = resp.read()
    filename = info.get("name") or info.get("title") or "evidence.bin"
    return content, str(filename)


def share_files_to_channel(
    channel_id: str,
    files: list[tuple[str, bytes, str]],
    *,
    initial_comment: str | None = None,
    token: str | None = None,
) -> dict:
    """Share one or more files in a single main-channel Slack message."""
    if not files:
        raise SlackError("share_files_to_channel", {"error": "no files to share"})

    specs: list[dict[str, str]] = []
    for filename, content, title in files:
        upload = call(
            "files.getUploadURLExternal",
            {"filename": filename, "length": str(len(content))},
            token,
        )
        _put_upload_url(upload["upload_url"], content)
        specs.append({"id": upload["file_id"], "title": title})

    complete: dict[str, str] = {
        "files": json.dumps(specs),
        "channel_id": channel_id,
    }
    if initial_comment:
        complete["initial_comment"] = initial_comment
    return call("files.completeUploadExternal", complete, token)

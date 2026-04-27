"""Pydantic models for HTTP request and response bodies.

One file per route module so the schemas live next to nothing else and are
easy to discover. Routes (`backend/routes/*.py`) only contain handlers,
HTTP wiring, and parsing helpers - all wire-format types are here.
"""

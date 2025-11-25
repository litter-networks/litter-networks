"""Command-line entry for lnwordtohtml."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import click

from .config import Config, resolve_path
from .runner import Runner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)


@click.group()
@click.option(
    "--config",
    "config_path",
    type=click.Path(path_type=Path),
    default=None,
    help="Optional path to a YAML config file overriding defaults.",
)
@click.pass_context
def app(ctx: click.Context, config_path: Optional[Path]) -> None:
    """lnwordtohtml utility commands."""

    ctx.ensure_object(dict)
    ctx.obj["config"] = Config.from_file(config_path) if config_path else Config()


@app.command()
@click.option(
    "--source",
    type=click.Path(path_type=Path, exists=False, file_okay=False),
    default=None,
    help="Root folder containing DOCX sources. Defaults to config.paths.source_root.",
)
@click.option(
    "--dry-run/--no-dry-run",
    default=True,
    help="When enabled, skip destructive actions and log what would happen.",
)
@click.option(
    "--dump-dir",
    type=click.Path(path_type=Path),
    default=None,
    help="Optional directory to write generated HTML/assets for comparison/review.",
)
@click.pass_context
def sync(ctx: click.Context, source: Path | None, dry_run: bool, dump_dir: Path | None) -> None:
    """Convert and synchronise docs to S3/DynamoDB."""

    config: Config = ctx.obj["config"]
    source_path = resolve_path(source or config.paths.source_root)
    dump_path = resolve_path(dump_dir) if dump_dir else None
    runner = Runner(
        config=config,
        source_dir=source_path,
        dry_run=dry_run,
        dump_dir=dump_path,
    )
    runner.run()


__all__ = ["app"]


if __name__ == "__main__":
    app()

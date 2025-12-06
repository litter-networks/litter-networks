# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

"""Helpers for building the knowledge hierarchy."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List

from .artifacts import ConvertedDocument

SAFE_SEGMENT = re.compile(r"^[a-zA-Z0-9_.-]+$")
PREFIX = "docs/"


@dataclass
class HierarchyNode:
    page_url: str
    page_title: str = ""
    page_description: str = ""
    child_pages: List["HierarchyNode"] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        data: Dict[str, object] = {"pageUrl": self.page_url}
        if self.page_title:
            data["pageTitle"] = self.page_title
        if self.page_description:
            data["pageDescription"] = self.page_description
        if self.child_pages:
            data["childPages"] = [child.to_dict() for child in self.child_pages]
        return data


def build_hierarchy(documents: Iterable[ConvertedDocument]) -> Dict[str, HierarchyNode]:
    root = HierarchyNode(page_url="")
    node_map: Dict[str, HierarchyNode] = {}

    for doc in documents:
        path_without_ext = doc.relative_path.with_suffix("").as_posix()
        segments = [segment for segment in path_without_ext.split("/") if segment]
        if not segments:
            continue

        current = root
        accumulated: List[str] = []

        for segment in segments:
            if not SAFE_SEGMENT.match(segment):
                current = None
                break

            accumulated.append(segment)
            key = "/".join(accumulated)
            unique_key = f"{PREFIX}{key}"
            node = node_map.get(unique_key)
            if node is None:
                node = HierarchyNode(page_url=unique_key)
                node_map[unique_key] = node
                current.child_pages.append(node)
            current = node

        if current and current is not root:
            current.page_title = doc.title or ""
            current.page_description = doc.subtitle or ""

    return node_map


def serialize_child_pages(node: HierarchyNode) -> str:
    return json.dumps([child.to_dict() for child in node.child_pages], ensure_ascii=False)


__all__ = ["HierarchyNode", "build_hierarchy", "serialize_child_pages"]

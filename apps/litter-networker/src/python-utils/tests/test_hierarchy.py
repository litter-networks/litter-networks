from pathlib import Path

from lnwordtohtml.artifacts import AssetUpload, ConvertedDocument, CssBundle
from lnwordtohtml.hierarchy import build_hierarchy, serialize_child_pages


def make_doc(path: str, title: str = "", desc: str = "") -> ConvertedDocument:
    return ConvertedDocument(
        source=Path("dummy.docx"),
        relative_path=Path(path),
        html="",
        title=title,
        subtitle=desc,
        assets=[],
        css_bundle=CssBundle(name="dummy", rules={}),
    )


def test_build_hierarchy_nests_children():
    docs = [
        make_doc("knowledge/getting-started.html", "Getting Started", "Intro"),
        make_doc("knowledge/getting-started/rules.html", "Rules", "Guidelines"),
        make_doc("knowledge/getting-started/safety.html", "Safety", "Advice"),
    ]

    hierarchy = build_hierarchy(docs)

    assert "docs/knowledge" in hierarchy
    assert "docs/knowledge/getting-started" in hierarchy
    assert "docs/knowledge/getting-started/rules" in hierarchy

    parent = hierarchy["docs/knowledge/getting-started"]
    assert parent.page_title == "Getting Started"
    assert len(parent.child_pages) == 2

    rules_node = hierarchy["docs/knowledge/getting-started/rules"]
    assert rules_node.page_title == "Rules"
    assert rules_node.page_description == "Guidelines"


def test_serialize_child_pages_includes_nested_children():
    docs = [
        make_doc("knowledge/a.html", "A"),
        make_doc("knowledge/a/b.html", "B"),
    ]
    hierarchy = build_hierarchy(docs)
    parent = hierarchy["docs/knowledge/a"]
    serialized = serialize_child_pages(parent)
    assert '"pageUrl": "docs/knowledge/a/b"' in serialized
    assert '"pageTitle": "B"' in serialized

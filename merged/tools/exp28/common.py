"""Shared helpers for EXP28 batch files."""
WP = "https://en.wikipedia.org/wiki/"


def src(k, title, org, url, claim, t="B", type_="reference"):
    return dict(k=k, title=title, org=org, url=url, claim=claim, t=t, type=type_, scope="topic")


def wp(k, page, claim, refs=""):
    """A Wikipedia source (tier B). `refs` names the works the page itself cites."""
    org = "Wikipedia" + (f" (citing {refs})" if refs else "")
    return src(k, page.replace("_", " "), org, WP + page, claim)

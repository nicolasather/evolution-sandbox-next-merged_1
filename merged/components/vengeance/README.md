# Vengeance UI components

[Vengeance UI](https://www.vengenceui.com) follows the shadcn registry model:
components are **copied into your project**, not installed as a package. The
files in this folder came from its registry
(`https://raw.githubusercontent.com/Ashutoshx7/VengeanceUI/main/public/r/<name>.json`,
commit `813d9c1`, 31 August 2026) under the MIT licence in `./LICENSE`.

## What is used, and where

| Component | Registry item | Used in | Changes from upstream |
|---|---|---|---|
| `AnimatedNumber` | `animated-number` | top-bar counter, via `animated-count.tsx` | accepts a string so a zero-padded counter keeps its digit count; unused `AnimatedScore` left out |
| `StatsCounter` | `stats-counter` | archive statistics | shows the value directly under reduced motion; named export added |
| `Kbd` | `kbd` | the `/` shortcut hint in the search box | none (verbatim); colours come from tokens in `app/globals.css` |
| `LineHoverLink` | `line-hover-link` | links on the method / FAQ / privacy / 404 pages and the archive note | internal hrefs use Next's `<Link>`; styles de-duplicated and placed in Tailwind's `components` layer; square focus ring |
| `FaqAccordion` | `faq-accordion` | the FAQ page | project tokens instead of neutral/dark: classes; square corners; labelled regions and `inert` closed answers |

Each file starts with a header naming its source and every change. Two of
them (`AnimatedNumber`, `StatsCounter`) run on **framer-motion**, which is why
it is a dependency; the sandbox wraps everything in
`<MotionConfig reducedMotion="user">` so those animations respect the
visitor's reduced-motion setting.

These files are excluded from `npm run lint` (see `eslint.config.mjs`) so they
stay close to upstream and easy to diff. They are still type-checked.

## Adding another component

`components.json` already maps the `@vengeanceui` namespace and points the
`ui` alias at this folder, so the documented command drops files here:

```bash
npx shadcn@latest add @vengeanceui/<component-name>
# or, without the namespace:
npx shadcn@latest add https://raw.githubusercontent.com/Ashutoshx7/VengeanceUI/main/public/r/<component-name>.json
```

Then restyle it onto the project tokens (`ink-*`, `bone-*`, `line*`, `ochre`)
before using it. Most of the library is built for bright, rounded, gradient-heavy
landing pages; this interface is a dark, square, near-monochrome museum room,
so components that cannot be brought into that register are better left out.

## A note on this dependency

The Vengeance UI docs publish a community-token contract address, with a link
to a crypto exchange, on their Next.js install page (checked in the repository
at commit `813d9c1`). That says nothing about the code, but a project with that
funding model can stop being maintained quickly. Because components are copied in
rather than installed, nothing here breaks if the upstream project goes away.

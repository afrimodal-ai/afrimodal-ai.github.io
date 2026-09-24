# afrimodal-ai.github.io

Source for the AfriModal AI website, served by GitHub Pages at <https://afrimodal-ai.github.io/>.

The site is plain HTML and CSS with no build step. Edit `index.html`, open it in a browser to check, and push to `main`; Pages publishes the repository root.

## Updating content

Each section in `index.html` has an `id` matching its navigation link. To add an entry, copy the pattern already used in that section:

- **Projects, Outputs**: replace the placeholder paragraph with a `<ul>` of entries once there is something to list. Link to the GitHub repository, Hugging Face page, arXiv record or DOI rather than describing the work at length.
- **People**: add an `<li>` to the list in `#people`, using the same `name`, `role` and `links` classes.
- **News**: add a new `<li>` at the top of the list in `#news`, with a `<time datetime="YYYY-MM">`.

If the site grows past a single page, add a new `.html` file at the root, link it from the navigation, and list it in `sitemap.xml`.

## Checks

The `Check` workflow validates the HTML and checks links on every push, on pull requests and weekly. To run the same checks locally:

```sh
npx html-validate@11 index.html 404.html
lychee index.html 404.html README.md
```

## Licence

Site code is released under the MIT licence (`LICENSE`). Text on the site is © Kayode Olaleye and may be reused under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) with attribution.

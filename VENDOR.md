# Vendored UI

Do not rewrite the vendor files. Pages use Bootstrap classes only.

| File | Source | Version |
|---|---|---|
| `public/vendor/bootswatch/minty/bootstrap.min.css` | Bootswatch Minty (full Bootstrap build) | 5.3.3 |
| `public/theme/moss.css` | Variable retint on top of Minty | site |
| `public/vendor/bootstrap/bootstrap.bundle.min.js` | Bootstrap bundle | 5.3.3 |
| `public/vendor/bootstrap-icons/` | Bootstrap Icons | 1.11.3 |

Minty supplies the components, radius, and type. `moss.css` only resets Bootstrap color variables, plus the two button rules Minty compiles to fixed colors.

# To Link or Not

A user study investigating how link visibility affects cognitive maps of node-link diagrams.

Participants are shown network graphs under different conditions — with links visible or hidden — and asked to answer questions that reveal how they mentally represent the underlying structure. The study examines whether hiding edges changes the cognitive map a viewer forms, and what this means for the design of network visualizations.

**Author:** Velitchko Filipov  
**Organization:** TU Wien  
**Contact:** velitchko.filipov@tuwien.ac.at

---

## Setup

This study is built on the [reVISit](https://revisit.dev) framework. Follow the steps below to run it locally or deploy it.

### Prerequisites

- [Node.js](https://nodejs.org) (LTS recommended)
- [Yarn](https://yarnpkg.com) — install with `npm i -g yarn` if needed

### Local development

```bash
git clone https://github.com/velitchko/to-link-or-not.git
cd to-link-or-not
yarn install
yarn serve
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Deployment

The study deploys automatically to GitHub Pages on push to `main` via GitHub Actions. The live version is available at:

**https://velitchko.github.io/to-link-or-not/**

To deploy your own fork:
1. Fork this repository
2. Enable GitHub Pages in your repo settings (source: GitHub Actions)
3. Update `VITE_BASE_PATH` in `.env` to match your repo name (e.g. `/your-repo-name/`)
4. Push to `main`

### Storage

Participant data is stored in [Supabase](https://supabase.com). The project is pre-configured with a Supabase instance — update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to point to your own project.

---

## Acknowledgements

This study was built using [reVISit](https://revisit.dev), an open-source framework for creating and deploying interactive, web-based user studies for visualization research.

> Yildirim, N., Sivaram, A., Slingsby, A., Rogers, L., Lex, A., & Meyer, M. (2024). reVISit: Scalable Evaluation of Interactive Visualizations in the Browser. *IEEE VIS*.

> Cutler, Z., Wilburn, J., Shrestha, H., Ding, Y., Bollen, B., Nadib, K.A., He, T., McNutt, A., Harrison, L., Lex, A. (2025). ReVISit 2: A Full Experiment Life Cycle User Study Framework. *IEEE VIS*

For documentation and tutorials, see [revisit.dev](https://revisit.dev). The reVISit source is maintained at [github.com/revisit-studies/study](https://github.com/revisit-studies/study).

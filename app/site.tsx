export type SitePage = "home" | "research" | "teaching" | "resources" | "service" | "cv";

export const pageInfo = {
  home: { path: "", label: "Home", title: "Henry Klatt | Mathematical Logic & Computability", description: "Henry Klatt is a mathematics Ph.D. student at the George Washington University. Research, teaching, service, and contact information." },
  research: { path: "research/", label: "Research", title: "Research | Henry Klatt", description: "Henry Klatt’s research in mathematical logic and computability theory, preprints, work in preparation, and selected talks." },
  teaching: { path: "teaching/", label: "Teaching", title: "Teaching | Henry Klatt", description: "Henry Klatt’s mathematics teaching experience at the George Washington University." },
  resources: { path: "resources/", label: "Resources for students", title: "Resources for students | Henry Klatt", description: "Mathematics resources for students, including 3Blue1Brown’s Essence of Calculus playlist and Henry Klatt’s Desmos graphs for Calculus I, II, and III." },
  service: { path: "service/", label: "Service", title: "Service | Henry Klatt", description: "Henry Klatt’s academic service, conference organization, and seminar organization." },
  cv: { path: "cv/", label: "CV", title: "CV | Henry Klatt", description: "Henry Klatt’s downloadable curriculum vitae." },
};

const papers = [
  { title: "On Cohesive Products of Fields", authors: "R. Dimitrov, V. Harizanov, H. Klatt, and K. Srinivasan", status: "Preprint · 2026", note: "Submitted to the Journal of Symbolic Logic.", href: "https://arxiv.org/abs/2604.09965" },
  { title: "HKSS Completeness of Quandles, Racks, and Keis", authors: "V. Harizanov and H. Klatt", status: "In preparation" },
  { title: "Cohesive Powers of Abelian Groups", authors: "V. Harizanov, M. ‘Turbo’ Ho, H. Klatt, M. Kukla, and K. Srinivasan", status: "In preparation" },
  { title: "Generalized Cohesive Products", authors: "V. Harizanov, H. Klatt, and K. Srinivasan", status: "In preparation" },
];

const talks = [
  { date: "September 22, 2026", title: "Cohesive Products of Galois Extensions", venue: "Logic Seminar · Iowa State University", type: "Seminar" },
  { date: "September 7–11, 2026", title: "Cohesive Products of Galois Extensions", venue: "Computability, Complexity, and Randomness · University of Leeds", type: "Invited talk" },
  { date: "May 29, 2026", title: "Countable Ultraproducts", venue: "Logicón · Universidad Nacional Autónoma de México", type: "Invited talk" },
  { date: "January 5, 2026", title: "Cohesive Products of Fields", venue: "Joint Mathematics Meetings · Washington, DC", type: "Invited talk" },
  { date: "April 6, 2025", title: "Cohesive Powers of Number Fields", venue: "AMS Eastern Sectional Meeting · Hartford, Connecticut", type: "Invited talk" },
  { date: "August 1, 2024", title: "Quandles are Complicated", venue: "FRG Workshop on Definability, Decidability, and Computability · Harvard University", type: "Invited talk" },
];

function ResearchPage({ rootPath }: { rootPath: string }) {
  return <>
    <section aria-labelledby="research-title">
      <h2 id="research-title">Research</h2>
      <p>My research is in mathematical logic, primarily computability theory, with a focus on ultraproduct-like constructions in model theory and computability theory. I also have interests in knot theory, algorithmic learning theory, and number theory.</p>
      <p>My advisor is Valentina Harizanov. I expect to complete my Ph.D. in spring 2027.</p>
      <p>In fall 2025, I held a research fellowship at the Hausdorff Research Institute for Mathematics in Bonn, in the programme “Definability, Decidability, and Computability.”</p>
    </section>
    <section aria-labelledby="papers-title">
      <h2 id="papers-title">Preprints and work in preparation</h2>
      <div className="paper-list">{papers.map((paper) => <article className="paper-entry" key={paper.title}>
        <h3>{paper.href ? <a href={paper.href}>{paper.title}</a> : paper.title}</h3>
        <p>{paper.authors}</p>
        <p className="entry-note">{paper.status}{paper.note && <>. {paper.note}</>}{paper.href && <> <a href={paper.href}>arXiv:2604.09965</a></>}</p>
      </article>)}</div>
    </section>
    <section aria-labelledby="talks-title">
      <h2 id="talks-title">Selected talks</h2>
      <div className="talk-list">{talks.map((talk) => <article className="dated-entry" key={`${talk.date}-${talk.title}`}><p className="entry-date">{talk.date}</p><div><h3>{talk.title}</h3><p className="entry-note">{talk.venue}</p></div></article>)}</div>
      <p><a href={`${rootPath}henry-klatt-cv.pdf`}>Complete list of talks in my CV</a></p>
    </section>
  </>;
}

function TeachingPage() {
  return <section aria-labelledby="teaching-title">
    <h2 id="teaching-title">Teaching</h2>
    <article className="teaching-entry"><h3>Instructor of Record</h3><p className="entry-note">The George Washington University · Summers 2023, 2025, and 2026</p><p>Math and Politics. Independently responsible for course delivery, assessment, and grading.</p></article>
    <article className="teaching-entry"><h3>Graduate Teaching Assistant</h3><p className="entry-note">The George Washington University · 2022–2026</p><p>Calculus I, II, and III; Math and Politics; Mathematical Ideas.</p></article>
  </section>;
}

const desmosGalleries = [
  {
    title: "Calculus 1 and 2: Desmos gallery",
    href: "https://www.desmos.com/gallery/11e3cf99-1ef5-42a6-9f48-fd8dceb15b7a",
    graphs: [
      { title: "Volumes of revolution", hash: "qebv3yiaot", tool: "3d" },
      { title: "Left Riemann sum", hash: "vgksfqkoov", tool: "calculator" },
      { title: "Area between curves", hash: "dn6v7ht6vd", tool: "calculator" },
    ],
  },
  {
    title: "Calculus 3: Desmos gallery",
    href: "https://www.desmos.com/gallery/ddfdd969-f788-4ca2-ae12-8665b6207bac",
    graphs: [
      { title: "The meaning of the plane equation", hash: "yerlgey8u5", tool: "3d" },
      { title: "Vector field", hash: "umsx6gnffj", tool: "calculator" },
      { title: "Gradient", hash: "3ceateg0il", tool: "3d" },
      { title: "TNB vectors and curvature", hash: "s1lnkak9sf", tool: "3d" },
    ],
  },
];

function ResourcesPage({ rootPath }: { rootPath: string }) {
  const playlist = "https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr";
  return <section aria-labelledby="resources-title">
    <h2 id="resources-title">Resources for students</h2>
    <div className="playlist-resource">
      <p>The greatest visualization for calculus, MUST WATCH: <a href={playlist}>3Blue1Brown’s Essence of Calculus</a></p>
      <a className="playlist-preview" href={playlist} aria-label="Watch 3Blue1Brown’s Essence of Calculus playlist">
        <img src={`${rootPath}resource-previews/essence-of-calculus.jpg`} width="1280" height="720" alt="Thumbnail for the first video in 3Blue1Brown’s Essence of Calculus playlist" />
        <span className="playlist-label">Watch the playlist</span>
      </a>
    </div>
    <div className="resource-galleries">
      {desmosGalleries.map((gallery) => <article className="resource-gallery" key={gallery.href}>
        <h3><a href={gallery.href}>{gallery.title}</a></h3>
        <ul className="graph-previews">
          {gallery.graphs.map((graph) => <li key={graph.hash}>
            <a className="graph-preview" href={`https://www.desmos.com/${graph.tool}/${graph.hash}`}>
              <img src={`${rootPath}resource-previews/desmos-${graph.hash}.png`} width="400" height="400" alt={`Preview of ${graph.title.toLowerCase()}`} loading="lazy" />
              <span>{graph.title}</span>
            </a>
          </li>)}
        </ul>
      </article>)}
    </div>
  </section>;
}

function ServicePage() {
  return <section aria-labelledby="service-title">
    <h2 id="service-title">Service</h2>
    <ul className="simple-list">
      <li><strong>Computability of Algebraic Structures.</strong> Lead organizer, BIRS Workshop, Casa Matemática Oaxaca. Scheduled for June 20–25, 2027.</li>
      <li><strong>Special Session on Mathematical Logic.</strong> Co-organizer, AMS Eastern Sectional Meeting, Washington, DC. October 3–4, 2026.</li>
      <li><strong>GW Logic Seminar.</strong> Co-organizer, 2022–present.</li>
    </ul>
  </section>;
}

function HomePage({ rootPath }: { rootPath: string }) {
  return <>
    <section className="welcome" aria-label="Welcome"><p>Welcome to my website.</p></section>
    <div className="home-overview">
    <section className="puzzle-section" aria-labelledby="puzzle-title" data-daily-puzzle="">
      <h2 id="puzzle-title">Lichess daily puzzle</h2>
      <div className="puzzle-frame">
        <div className="puzzle-loading">Loading today’s puzzle…</div>
        <div className="puzzle-board" role="group" aria-label="Chess board" aria-describedby="puzzle-instruction" hidden />
        <div className="puzzle-promotion" role="dialog" aria-modal="true" aria-labelledby="promotion-title" hidden>
          <div className="promotion-panel"><h3 id="promotion-title">Choose a promotion</h3><div className="promotion-choices" /><button className="promotion-cancel" type="button">Cancel</button></div>
        </div>
      </div>
      <div className="entry-note puzzle-actions">
        <p className="puzzle-instruction" id="puzzle-instruction">Select a piece, then its destination, or drag it.</p>
        <p className="puzzle-status" role="status" aria-live="polite" aria-atomic="true">Loading today’s puzzle…</p>
        <div className="puzzle-buttons">
          <button className="puzzle-restart" type="button" disabled>Restart</button>
          <button className="puzzle-hint" type="button" disabled>Hint</button>
          <button className="puzzle-retry" type="button" hidden>Retry loading</button>
          <a className="puzzle-link" href="https://lichess.org/training/daily">Open on Lichess</a>
        </div>
        <p className="puzzle-credit">Chess pieces by <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Cburnett</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</p>
        <noscript>Enable JavaScript to play here, or use the Lichess link.</noscript>
      </div>
    </section>
    <section className="photo-section" aria-label="Photo of Henry">
      <figure className="contact-photo">
        <img src={`${rootPath}henry-mushroom.png`} width="1200" height="1600" alt="Henry holding a large orange mushroom outdoors" />
        <figcaption>Don't munch on a hunch!</figcaption>
      </figure>
    </section>
    </div>
    <div className="bike-overview">
      <figure className="bicycle-diagram">
        <img src={`${rootPath}bicycle-diagram.png`} width="960" height="580" alt="Bicycle anatomy diagram with English labels identifying the frame, wheels, handlebars, brakes, saddle, and drivetrain" />
        <figcaption className="entry-note"><a href="https://commons.wikimedia.org/wiki/File:Bicycle_diagram-en_(2).svg">Bicycle diagram</a> by Al2, licensed under <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.</figcaption>
      </figure>
      <section className="bike-instructions" aria-labelledby="bike-instructions-title">
        <h2 id="bike-instructions-title">How to fix your bike.</h2>
        <ol className="simple-list">
          <li>Diagnose the problem with google</li>
          <li>Have or acquire the right tools</li>
          <li>Follow the <a href="https://www.youtube.com/parktool">Park Tools video</a> to the letter</li>
        </ol>
      </section>
    </div>
  </>;
}

function CVPage({ rootPath }: { rootPath: string }) {
  return <section aria-labelledby="cv-title">
    <h2 id="cv-title">CV</h2>
    <p><a href={`${rootPath}henry-klatt-cv.pdf`} download="Henry-Klatt-CV.pdf">Download CV (PDF)</a></p>
  </section>;
}

export function AcademicSite({ page = "home" }: { page?: SitePage }) {
  const rootPath = page === "home" ? "./" : "../";
  return <>
    <a href="#main" className="skip-link">Skip to content</a>
    <div className="page">
      <header id="top" className="site-header">
        <div className="header-title">
          <div id="contact" className="header-contact" aria-labelledby="contact-title">
            <h2 id="contact-title">Contact</h2>
            <p>Department of Mathematics<br />The George Washington University<br />Washington, DC</p>
            <img className="email-image" src={`${rootPath}email-contact.png`} width="300" height="57" alt="University email address, displayed as an image" />
          </div>
          <div className="header-identity">
            <div className="header-name">
              <h1>Henry Klatt</h1>
              <a className="hometown-link" href="https://en.wikipedia.org/wiki/Mason_City,_Iowa" aria-label="My home town: Mason City, Iowa on Wikipedia" aria-describedby="hometown-tooltip">
                <img src={`${rootPath}mr-toot.png`} width="1320" height="1192" alt="Mr. Toot" />
                <span id="hometown-tooltip" className="hometown-tooltip" role="tooltip">my home town</span>
              </a>
            </div>
            <p>Ph.D. student in mathematics</p>
            <p>Department of Mathematics, The George Washington University</p>
            <p>ORCID: <a href="https://orcid.org/0009-0004-3329-1657" rel="me">0009-0004-3329-1657</a></p>
          </div>
          <div className="theme-controls"><button className="theme-toggle" type="button" aria-pressed="false" hidden>Dark mode</button></div>
        </div>
        <nav className="desktop-nav" aria-label="Main navigation">{(Object.entries(pageInfo) as [SitePage, typeof pageInfo[SitePage]][]).map(([key, item]) => <a key={key} href={`${rootPath}${item.path}`} aria-current={key === page ? "page" : undefined}>{item.label}</a>)}</nav>
      </header>
      <main id="main">
        {page === "home" && <HomePage rootPath={rootPath} />}
        {page === "research" && <ResearchPage rootPath={rootPath} />}
        {page === "teaching" && <TeachingPage />}
        {page === "resources" && <ResourcesPage rootPath={rootPath} />}
        {page === "service" && <ServicePage />}
        {page === "cv" && <CVPage rootPath={rootPath} />}
      </main>
      <footer className="site-footer"><p>© {new Date().getFullYear()} Henry Klatt</p><div><a href="#contact">Contact</a><a href="#top">Back to top</a></div></footer>
    </div>
  </>;
}

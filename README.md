# Itkan Rangers FTC Learning Platform

Static GitHub Pages site for Itkan Rangers FTC Team 28922.

## Rangers Hub

The website includes:

- Team dashboard with Academy progress, XP totals, and a local mechanism-test planner.
- Robot showcase with the drivetrain, scoring hood, vision, and odometry highlights.
- Competition Center linking the DECODE, BIOBUZZ, and INTO THE DEEP season archives.
- Interactive robot builder with selectable drivetrain, intake, scoring mechanism, end effector, and sensor concept. The builder exports a plain-text configuration summary; it is a concept sketch, not dimensionally accurate CAD.
- Team progress board with verified team milestones. A shared member leaderboard is not connected because Academy XP is currently stored in each visitor's browser.
- Media Center with local photo/video previews. Local previews do not publish files to the website.
- FTC Academy with separate CAD and Programming tracks, lessons, challenges, XP, and five course paths.
- FTC Java examples in `teamcode/src/main/java/org/firstinspires/ftc/teamcode/`.

## Run locally

Open `index.html` in a modern browser. The site uses browser JavaScript and local storage; no account, server, or Supabase project is required.

## Publish with GitHub Pages

Keep `index.html` at the published root. GitHub Pages serves the static site from the repository's configured publishing branch or directory.

## Progress and leaderboard

Academy lessons, challenges, and XP are stored in local storage on the device/browser used to complete them. This does not synchronize progress between visitors. A genuine shared leaderboard needs a secured backend, authentication, and a team-approved roster. The site does not invent member scores.

## Media publishing

The Media Center can preview selected files locally. To publish media for all visitors, add approved assets to `media/photos/` or `media/videos/`, add the relevant path and caption to the `publishedMedia` array in `index.html`, and commit the changes. A public browser form cannot securely write files to the GitHub repository without a backend and authenticated publishing workflow.

## FTC Java examples

The sample OpModes are in the TeamCode package. Copy them into the matching package of the official FTC Robot Controller Android Studio project. Update hardware names, motor directions, servo positions, and mechanism logic for the actual robot. Compile against the team's installed FTC SDK and test with the robot safely supported before normal operation. These are starter examples, not verified plug-and-play code for the team's hardware.

## Supporting guides

- [FTC Controller project format](docs/FTC-CONTROLLER-FORMAT.md)
- [Onshape CAD guide](docs/Onshape-CAD-Guide.md)
- [Competition software checklist](docs/Competition-Software-Checklist.md)
- [Media publishing workflow](media/README.md)

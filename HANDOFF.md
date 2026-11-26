# Handoff

Signal Works is a standalone personal academy with eight curriculum tracks, four simulated benches and six guided field projects. No employer material or live plant interface is included.

## Maintain the site

The dashboard leads into the interactive 3D server-room exercise. The scene renderer is shared by the dashboard and room workspace. The room guide explains the assumptions and real installation checks. Release checks cover orbit and zoom, equipment placement, port pairing, network commissioning, fault recovery and the small-screen layout.

- Edit the lesson content in `lessons.js`. Progress keys consist of a track ID and lesson index, so append lessons rather than reordering existing entries on a published track.
- The dashboard lives in `index.html`, `style.css` and `app.js`. The labs and field projects each have a separate HTML, CSS and JavaScript file.
- The source repository is [industrial-systems-academy](https://github.com/Sajeevanveeriah/industrial-systems-academy). The public target is the same-named Cloudflare Pages project in the Portfolio account. Publish only the build output. See README.md for the command.
- Before release, exercise quiz feedback and progress after reload, all four benches including failure paths, workbook note isolation and the mobile layout. After release compare hosted assets to the checked build. To roll back, redeploy a previously verified commit to the same project.

Practical evidence is recorded by the learner. A passed quiz, checked box or working simulation is not verification of a physical installation.

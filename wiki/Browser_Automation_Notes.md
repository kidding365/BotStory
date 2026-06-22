# Technical Note: Browser Automation Workflow

This document records the specific method and toolchain used to interact with the live Infinite Worlds platform for research and debugging.

## 1. Toolchain
- **Binary**: `/home/ion/.browser_use_venv/bin/browser-use`
- **Target**: Chromium instance running with remote debugging enabled on `127.0.0.1:9222`.

## 2. Connection Strategy
The most reliable method for connecting to the existing live session was the `connect` command:
```bash
browser-use connect
```
This command auto-discovers the running Chrome instance via the Chrome DevTools Protocol (CDP). 

*Note: If session conflicts occur (e.g., "Session 'default' is already running"), use `browser-use close` to reset the daemon before reconnecting.*

## 3. Interaction Pattern
The automation followed a "State-Action-Verify" loop:

1.  **State Capture**: Run `browser-use state`. This returns a simplified DOM tree where every interactive element is prefixed with a unique index (e.g., `[43584]<button /> AI model: Lynx-thinking`).
2.  **Action**: Use the index to perform a targeted mutation:
    - `browser-use click <index>`: Trigger buttons or inputs.
    - `browser-use scroll down`: Navigate long pages to bring elements into the viewport.
    - `browser-use get html`: Extract the full DOM for deep analysis of narrative text or hidden fields.
3.  **Verification**: Run `state` again to confirm the page transitioned or the modal opened.

## 4. Handling Modals & Dynamic Content
Infinite Worlds uses a complex virtual DOM (Anvil.works). Key findings for automation:
- **Modals**: Modals (like the Menu or Image Details) often appear as `alert-modal` divs.
- **Indices**: Element indices are dynamic. Always capture the current `state` immediately before a `click` to ensure the index is still valid.
- **Wait Times**: Since the platform relies on AI generation, a `sleep` period (e.g., 2-5 seconds) is often necessary after a "Take Action" click before the narrative content is available in the DOM.

## 5. Debugging Utility
This method allows for "Grey Box" testing:
- We can see the **User's View** (via `state` and screenshots).
- We can see the **AI's View** (via the World Debug Tools in the Menu).
- We can simulate **User Errors** or **Edge Cases** by manually triggering the `Import JSON` or `Edit Turn` features.

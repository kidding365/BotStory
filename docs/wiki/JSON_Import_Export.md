# Guide: JSON Import & Export for BotStory

The Raw JSON feature provides a "backdoor" for advanced world management, enabling the import of complex story schemas and the export of existing worlds for backup or sharing.

## 1. Accessing the JSON Interface
1. Open the **World Editor** for the target world.
2. Scroll to the **Misc advanced features (optional)** section.
3. Enable the **Show raw JSON** checkbox.

## 2. Exporting a World (Backup/Sharing)
To export a world's full configuration:
1. Ensure the JSON view is current by clicking **Refresh raw JSON**.
2. Copy the entire content of the JSON textarea.
3. Save this content as a `.json` file.

## 3. Importing a Story/World
To import an external story schema:
1. Open an existing world (or create a new blank one).
2. Enable **Show raw JSON**.
3. Paste the external JSON content directly into the JSON textarea, replacing all existing text.
4. Click **Import JSON to world**.
5. **Crucial**: After importing, the UI may not immediately reflect the changes. You should either:
    - Refresh the browser page.
    - Save the world using **Save changes and exit** to commit the imported state.

## 4. Critical Synchronization Rules
The JSON view is **not** live-synced with the UI. This creates two specific risks:

| Action | Effect | Risk |
| :--- | :--- | :--- |
| **UI $\rightarrow$ JSON** | Clicking `Refresh raw JSON` overwrites the textarea with the current UI state. | Any manual edits made in the textarea *before* clicking refresh will be **lost**. |
| **JSON $\rightarrow$ UI** | Clicking `Import JSON to world` overwrites the UI settings with the textarea content. | Any changes made in the UI *before* clicking import will be **overwritten**. |

## 5. Validation & Safety
- **Valid JSON**: The "Import" action will fail or cause errors if the JSON is syntactically invalid (e.g., missing commas, unmatched brackets). Use a JSON validator before importing.
- **Schema Version**: Ensure the imported JSON matches the current platform schema version (e.g., `schemaVersion: 2.1`) to prevent unexpected behavior or data loss.
- **Manual Backup**: Always export the current world state before performing an import.

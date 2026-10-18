// The shipped dialogue templates, imported as JSON so the renderer works in
// the browser bundle as well as in Node.

import type { CharId } from "../data.ts";
import type { DialogueFile } from "./schema.ts";
import bear from "../../content/dialogue/bear.json" with { type: "json" };
import egg from "../../content/dialogue/egg.json" with { type: "json" };
import folder from "../../content/dialogue/folder.json" with { type: "json" };
import mallet from "../../content/dialogue/mallet.json" with { type: "json" };
import marble from "../../content/dialogue/marble.json" with { type: "json" };
import pail from "../../content/dialogue/pail.json" with { type: "json" };

export const DIALOGUE: Partial<Record<CharId, DialogueFile>> = {
  bear: bear as DialogueFile,
  egg: egg as DialogueFile,
  folder: folder as DialogueFile,
  mallet: mallet as DialogueFile,
  marble: marble as DialogueFile,
  pail: pail as DialogueFile,
};

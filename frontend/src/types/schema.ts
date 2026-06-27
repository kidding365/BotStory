export interface WorldSchema {
  title: string;
  description: string;
  background: string;
  instructions: string;
  authorStyle: string;
  firstInput: string;
  objective: string;
  possibleCharacters: Character[];
  triggerEvents: TriggerEvent[];
  instructionBlocks: InstructionBlock[];
  loreBookEntries: LoreBookEntry[];
  trackedItems: TrackedItem[];
  victoryCondition: GameCondition;
  defeatCondition: GameCondition;
  imageStyleCharacterPre?: string;
  imageStyleCharacterPost?: string;
  imageStyleNonCharacterPre?: string;
  imageStyleNonCharacterPost?: string;
}

export interface Character {
  characterId: string;
  name: string;
  description: string;
  portrait: string;
  skills: Record<string, number>;
}

export interface TriggerEvent {
  id: string;
  name: string;
  triggerConditions: TriggerCondition[];
  triggerEffects: TriggerEffect[];
}

export interface TriggerCondition {
  id: string;
  type: "triggerOnEvent" | "valueCheck";
  data: any;
}

export interface TriggerEffect {
  id: string;
  type: "effectShowMessage" | "effectSetTrackedItemValue" | "effectModifyInstructionBlock";
  data: any;
}

export interface InstructionBlock {
  id: string;
  name: string;
  content: string;
}

export interface LoreBookEntry {
  id: string;
  name: string;
  content: string;
  keywords: string[];
}

export interface TrackedItem {
  id: string;
  name: string;
  dataType: "text" | "number" | "xml";
  initialValue: any;
  updateInstructions: string;
  autoUpdate: boolean;
}

export interface GameCondition {
  condition: string;
  text: string;
  alreadyFired: boolean;
}

export interface GameState {
  world: WorldSchema;
  session: {
    character: Character;
    currentValues: Record<string, any>;
    modifiedInstructions: Record<string, string>;
    firedTriggers: string[];
    history: { role: "user" | "model"; content: string; narrative?: string; images?: string[] }[];
  };
}

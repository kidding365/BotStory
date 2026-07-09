export type DataType = 'text' | 'number' | 'xml';
export type Visibility = 'everyone' | 'ai_only' | 'player_only';
export type PCValueMode = 'same' | string;

export interface PossibleCharacter {
  name: string;
  description: string;
  portrait?: string;
  fullSizePortrait?: string;
  characterId: string;
  skills: Record<string, number>;
  initialTrackedItemValues?: Record<string, string | number>;
}

export interface TrackedItem {
  id: string;
  name: string;
  positionInList?: number;
  dataType: DataType;
  visibility: Visibility;
  description: string;
  updateInstructions: string;
  initialValue: string | number;
  initialValueBasedOnPC?: PCValueMode;
  autoUpdate?: boolean;
  value?: string | number;
}

export interface InstructionBlock {
  id: string;
  name: string;
  content: string;
  keywords?: string[];
  isActive?: boolean;
}

export interface LoreBookEntry {
  id: string;
  name: string;
  content: string;
  keywords: string[];
}

export interface TriggerCondition {
  id?: string;
  type: 'triggerOnEvent' | 'triggerOnTurn' | 'triggerOnItemValue' | 'triggerOnRandomChance';
  category?: 'condition';
  data: string;
}

export interface TriggerEffect {
  id?: string;
  type:
    | 'effectShowMessage'
    | 'effectSetTrackedItemValue'
    | 'effectModifyInstructionBlock'
    | 'effectEndGame';
  data: string | { [k: string]: unknown };
}

export interface TriggerEvent {
  id: string;
  name: string;
  triggerEffects: TriggerEffect[];
  triggerConditions: TriggerCondition[];
}

export interface EndCondition {
  condition: string;
  text: string;
  alreadyFired?: boolean;
}

export interface World {
  id: string;
  title: string;
  name: string;
  description: string;
  background: string;
  instructions: string;
  authorStyle: string;
  recommendedAIModel?: string;
  firstInput?: string;
  objective: string;
  imageModel?: string;
  imageStyle?: string | null;
  illustrationStyleNonCharacterLowPriority?: string;
  illustrationStyleNonCharacterHighPriority?: string;
  illustrationStyleCharacterLowPriority?: string;
  illustrationStyleCharacterHighPriority?: string;
  imageStyleCharacterPre?: string;
  imageStyleCharacterPost?: string;
  imageStyleNonCharacterPre?: string;
  imageStyleNonCharacterPost?: string;
  mature: boolean;
  nsfw: boolean;
  contentWarnings?: string;
  enableAISpecificInstructionBlocks?: boolean;
  previewImage?: string;
  fullSizePreviewImage?: string;
  skills: string[];
  possibleCharacters: PossibleCharacter[];
  triggerEvents: TriggerEvent[];
  victoryCondition: EndCondition;
  defeatCondition: EndCondition;
  instructionBlocks: InstructionBlock[];
  loreBookEntries: LoreBookEntry[];
  trackedItems: TrackedItem[];
  schemaVersion?: number;
  version?: string;
  source?: 'native' | 'infiniteworlds';
  importedAt?: number;
  // Engine-internal legacy fields
  globalPrompt?: string;
  lorebook?: LoreBookEntry[];
  triggers?: TriggerEvent[];
}

export interface StoryInstance {
  id: string;
  worldId: string;
  characterId: string | null;
  currentValues: Record<string, string | number>;
  modifiedBlocks: Record<string, string>;
  firedTriggers: string[];
  firedTriggerOutcomes?: Record<string, boolean>;
  turnNumber: number;
  history: TurnMessage[];
  lastOutcome?: AIOutcome;
  createdAt: number;
  updatedAt: number;
  ended?: boolean;
  endMessage?: string;
}

export interface TurnMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  imageInstructions?: string;
  reasoning?: string;
  suggestedActions?: string[];
  visualPrompt?: string;
  imageDataUrl?: string;
}

export interface AIOutcome {
  reasoning?: string;
  narrative: string;
  whereWhen?: string;
  evaluation?: 'SUCCESS' | 'FAILURE' | 'DENIED' | string;
  stateUpdates: Record<string, string | number>;
  visualVariables: Record<string, string>;
  visualPrompt?: string;
  suggestedActions: string[];
  triggeredEvents: string[];
  imageInstructions?: string;
  ended?: boolean;
  endMessage?: string;
}

export interface UserAction {
  text: string;
  imageInstructions?: string;
  narrativeOverride?: string;
}

export interface TurnResult {
  outcome: AIOutcome;
  updatedInstance: StoryInstance;
  triggerMessages: string[];
  imageDataUrl?: string;
}

export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'custom';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  apiKey: string;
  endpoint?: string;
  model: string;
  imageModel?: string;
}

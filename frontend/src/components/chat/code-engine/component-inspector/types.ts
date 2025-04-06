// Type definitions for the Component Inspector

// Component data from custom inspector
export interface ComponentData {
  id: string;
  selector?: string;
  tagName: string;
  className: string;
  // Additional properties observed in actual data
  name?: string;
  path?: string;
  line?: string;
  file?: string;
  column?: string;
  textContent?: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  content: {
    text: string;
    html: string;
  };
  attributes?: { [key: string]: string };
  children?: ComponentData[];
}

// Computed CSS styles object
export interface ComputedStyles {
  [key: string]: string;
}

// Custom styles for the selected component
export interface CustomStyles {
  [key: string]: string;
}

// Spacing input fields state
export interface SpacingInputs {
  [key: string]: string;
}

// Props for all component inspector components
export interface InspectorProps {
  selectedComponent: ComponentData | null;
  computedStyles: ComputedStyles | null;
  customStyles: CustomStyles;
  isStyleEdited: boolean;
  isContentEdited: boolean;
  applyingChanges: boolean;
  setCustomStyles: (styles: CustomStyles) => void;
  setIsStyleEdited: (edited: boolean) => void;
  setIsContentEdited: (edited: boolean) => void;
  applyStyleChanges: () => void;
  applyContentChanges: (content: string) => void;
}

// Tab-specific props
export interface StylesTabProps extends InspectorProps {
  spacingInputs: SpacingInputs;
  setSpacingInputs: React.Dispatch<React.SetStateAction<SpacingInputs>>;
  handleSpacingInputChange: (
    property: string,
    value: string,
    bothSides?: boolean,
    pairedProperty?: string
  ) => void;
  handleStyleChange: (property: string, value: string) => void;
  setCustomStyles: React.Dispatch<React.SetStateAction<CustomStyles>>;
  setIsStyleEdited: (edited: boolean) => void;
}

export interface ContentTabProps extends InspectorProps {
  editableContent: string;
  originalContent: string;
  setEditableContent: (content: string) => void;
  handleStyleChange: (property: string, value: string) => void;
}

export interface ClassesTabProps extends InspectorProps {
  saveClassesToFile: () => void;
}

export interface InfoTabProps extends InspectorProps {}

// Utility component props
export interface SpacingControlsProps {
  property: string;
  label: string;
  pairedProperty?: string;
  displayValue: string;
  onValueChange: (
    property: string,
    value: string,
    bothSides?: boolean,
    pairedProperty?: string
  ) => void;
}

export interface ColorPickerProps {
  style: string;
  label: string;
  color: string;
  onChange: (property: string, value: string) => void;
}

export interface TypographyControlsProps {
  customStyles: CustomStyles;
  computedStyles: ComputedStyles | null;
  onChange: (property: string, value: string) => void;
}

// Message event types
export interface StyleUpdateMessage {
  type: string;
  payload: {
    success: boolean;
    styles?: ComputedStyles;
    elementData?: ComponentData;
    appliedStyles?: CustomStyles;
    error?: string;
  };
}

export interface ContentUpdateMessage {
  type: string;
  payload: {
    success: boolean;
    elementData?: ComponentData;
    appliedContent?: string;
    error?: string;
  };
}

export interface ComponentClickMessage {
  type: string;
  componentData: ComponentData;
}

export type InspectorMessage =
  | StyleUpdateMessage
  | ContentUpdateMessage
  | ComponentClickMessage;

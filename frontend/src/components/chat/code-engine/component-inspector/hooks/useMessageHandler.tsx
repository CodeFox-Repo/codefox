import { useEffect } from 'react';
import { 
  ComponentData, 
  ComputedStyles, 
  CustomStyles, 
  SpacingInputs 
} from '../types';
import { initializeSpacingInputs } from '../utils/style-utils';

/**
 * Custom hook for handling iframe message communication
 */
interface UseMessageHandlerProps {
  setSelectedComponent: React.Dispatch<React.SetStateAction<ComponentData | null>>;
  setComputedStyles: React.Dispatch<React.SetStateAction<ComputedStyles | null>>;
  setCustomStyles: React.Dispatch<React.SetStateAction<CustomStyles>>;
  setSpacingInputs: React.Dispatch<React.SetStateAction<SpacingInputs>>;
  setIsContentEdited: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStyleEdited: React.Dispatch<React.SetStateAction<boolean>>;
  setEditableContent: React.Dispatch<React.SetStateAction<string>>;
  setOriginalContent: React.Dispatch<React.SetStateAction<string>>;
  setApplyingChanges: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useMessageHandler = ({
  setSelectedComponent,
  setComputedStyles,
  setCustomStyles,
  setSpacingInputs,
  setIsContentEdited,
  setIsStyleEdited,
  setEditableContent,
  setOriginalContent,
  setApplyingChanges
}: UseMessageHandlerProps) => {
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type) {
        console.warn("Received message with missing type:", event.data);
        return;
      }
      
      console.log("ComponentInspector received message:", event.data.type);
      
      // Handle component click data forwarded from iframe-click-handler
      if (event.data.type === 'COMPONENT_CLICK') {
        console.log("Processing component click:", event.data.componentData);
        setSelectedComponent(event.data.componentData);
        setComputedStyles(null); // Reset computed styles
        setCustomStyles({}); // Reset custom styles
        setIsContentEdited(false);
        setIsStyleEdited(false);
        
        // Reset spacing inputs
        setSpacingInputs({});
        
        // Get latest content and store it as the original content too
        if (event.data.componentData.content.text) {
          setEditableContent(event.data.componentData.content.text);
          setOriginalContent(event.data.componentData.content.text);
        } else {
          setEditableContent('');
          setOriginalContent('');
        }
      } else if (event.data.type === 'ELEMENT_STYLES') {
        console.log("Processing element styles response:", event.data.payload);
        if (event.data.payload && event.data.payload.success) {
          console.log("Received computed styles:", event.data.payload.styles);
          
          // Process received styles
          const styles = event.data.payload.styles;
          
          // Initialize spacing inputs from computed styles
          const initialSpacingInputs = initializeSpacingInputs(styles);
          setSpacingInputs(initialSpacingInputs);
          setComputedStyles(styles);
        } else {
          console.error("Error fetching styles:", event.data.payload?.error || "Unknown error");
        }
      } else if (event.data.type === 'ELEMENT_STYLE_UPDATED') {
        console.log("Processing style update response:", event.data.payload);
        setApplyingChanges(false);
        
        if (event.data.payload && event.data.payload.success) {
          // Update the selected component with new data
          setSelectedComponent(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...event.data.payload.elementData,
            };
          });
          
          // Display confirmation
          console.log('Style updated successfully', event.data.payload.appliedStyles);
          setIsStyleEdited(false);
        } else {
          console.error("Style update failed:", event.data.payload?.error || "Unknown error");
          alert(`Failed to update style: ${event.data.payload?.error || "Unknown error"}`);
        }
      } else if (event.data.type === 'ELEMENT_CONTENT_UPDATED') {
        console.log("Processing content update response:", event.data.payload);
        setApplyingChanges(false);
        
        if (event.data.payload && event.data.payload.success) {
          // Update the selected component with new data
          setSelectedComponent(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...event.data.payload.elementData,
              content: {
                ...prev.content,
                text: event.data.payload.appliedContent,
              },
            };
          });
          
          // Display confirmation
          console.log('Content updated successfully');
          setIsContentEdited(false);
        } else {
          console.error("Content update failed:", event.data.payload?.error || "Unknown error");
          alert(`Failed to update content: ${event.data.payload?.error || "Unknown error"}`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    setSelectedComponent, 
    setComputedStyles, 
    setCustomStyles, 
    setSpacingInputs,
    setIsContentEdited,
    setIsStyleEdited,
    setEditableContent,
    setOriginalContent,
    setApplyingChanges
  ]);
}; 
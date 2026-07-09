import React, { useContext, useState } from 'react';
import { ProjectContext, ProjectProvider } from './code-engine/project-context';

export interface Project {
  id: string;
  projectName: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isDeleted: boolean;
  userId: string;
  projectPackages: ProjectPackage[];
}

interface ProjectPackage {
  name: string;
  version: string;
}

const ProjectModal = ({ isOpen, onClose, refetchProjects }) => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const { createNewProject } = useContext(ProjectContext);
  if (!isOpen) return null; // Don't render the modal when it's closed

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 z-50">
        <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
        <form onSubmit={() => createNewProject(projectName, description)}>
          <div className="mb-4">
            <label className="block text-sm font-medium">Project Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 mr-2 bg-gray-300 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;

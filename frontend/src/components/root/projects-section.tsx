import { useQuery } from '@apollo/client';
import { FETCH_PUBLIC_PROJECTS } from '@/graphql/request';
import { ExpandableCard } from './expand-card';

export function ProjectsSection() {
  // Execute the GraphQL query with provided variables
  const { data, loading, error } = useQuery(FETCH_PUBLIC_PROJECTS, {
    // Make sure strategy matches the backend definition (e.g., 'latest' or 'trending')
    variables: { input: { size: 10, strategy: 'latest' } },
  });

  const fetchedProjects = data?.fetchPublicProjects || [];

  // Transform fetched data to match the component's expected format
  const transformedProjects = fetchedProjects.map((project) => ({
    id: project.id,
    name: project.projectName,
    path: project.projectPath,
    createDate: project.createdAt
      ? new Date(project.createdAt).toISOString().split('T')[0]
      : '2025-01-01',
    author: project.user?.username || 'Unknown',
    forkNum: project.subNumber || 0,
    image:
      project.photoUrl || `https://picsum.photos/500/250?random=${project.id}`,
  }));

  return (
    <section className="w-full max-w-7xl mx-auto px-4">
      <div className="mb-8">
        {/* Header and "View All" button always visible */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold dark:text-white">
            Featured Projects
          </h2>
          <button className="text-primary-600 dark:text-primary-400 hover:underline">
            View All &rarr;
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : error ? (
          <div className="text-center py-10">Error: {error.message}</div>
        ) : (
          <div>
            {transformedProjects.length > 0 ? (
              <ExpandableCard projects={transformedProjects} />
            ) : (
              // Show message when no projects are available
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                No projects available.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

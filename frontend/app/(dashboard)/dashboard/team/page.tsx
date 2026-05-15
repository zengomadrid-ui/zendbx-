"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  slug: string;
  database_name: string;
  status: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  joined_at: string;
}

interface ProjectWithMembers extends Project {
  members?: Member[];
  memberCount?: number;
  myRole?: string;
}

export default function TeamOverviewPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectsWithTeamInfo();
  }, []);

  const fetchProjectsWithTeamInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // Fetch all projects
      const projectsRes = await fetch("http://localhost:8000/api/projects", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!projectsRes.ok) {
        throw new Error("Failed to fetch projects");
      }
      
      const projectsData = await projectsRes.json();
      
      // Fetch team members for each project
      const projectsWithMembers = await Promise.all(
        projectsData.map(async (project: Project) => {
          try {
            const membersRes = await fetch(
              `http://localhost:8000/api/projects/${project.id}/members`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (membersRes.ok) {
              const members = await membersRes.json();
              const currentUserId = localStorage.getItem("user_id");
              const myMembership = members.find((m: Member) => m.user_id === currentUserId);
              
              return {
                ...project,
                members,
                memberCount: members.length,
                myRole: myMembership?.role || "unknown"
              };
            }
          } catch (error) {
            console.error(`Failed to fetch members for project ${project.id}:`, error);
          }
          
          return {
            ...project,
            members: [],
            memberCount: 0,
            myRole: "owner"
          };
        })
      );
      
      setProjects(projectsWithMembers);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-orange-900/20 text-orange-400 border-orange-800";
      case "editor":
        return "bg-blue-900/20 text-blue-400 border-blue-800";
      case "viewer":
        return "bg-gray-900/20 text-gray-400 border-gray-800";
      default:
        return "bg-green-900/20 text-green-400 border-green-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f0f] text-white">
        <div className="text-gray-400">Loading team information...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#ededed] mb-2">Team Collaboration</h1>
        <p className="text-[#a1a1a1]">
          Manage team members and collaborate on your projects
        </p>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-[#181818] border-2 border-dashed border-[#2a2a2a] rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#ededed] mb-2">No projects yet</h3>
          <p className="text-sm text-[#6b6b6b] mb-4">
            Create a project to start collaborating with your team
          </p>
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 hover:border-[#3a3a3a] transition-all group cursor-pointer"
              onClick={() => router.push(`/dashboard/projects/${project.id}/team`)}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#ededed] group-hover:text-orange-500 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-[#6b6b6b]">{project.database_name}</p>
                  </div>
                </div>
              </div>

              {/* My Role */}
              <div className="mb-4">
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${getRoleBadgeColor(project.myRole || "")}`}>
                  Your role: {project.myRole}
                </span>
              </div>

              {/* Team Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#a1a1a1]">Team Members</span>
                  <span className="text-sm font-semibold text-[#ededed]">
                    {project.memberCount || 1}
                  </span>
                </div>

                {/* Member Avatars */}
                {project.members && project.members.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 5).map((member, idx) => (
                        <div
                          key={member.id}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 border-2 border-[#181818] flex items-center justify-center text-white text-xs font-bold"
                          title={member.full_name || member.email}
                        >
                          {(member.full_name || member.email)?.[0]?.toUpperCase()}
                        </div>
                      ))}
                      {project.members.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] border-2 border-[#181818] flex items-center justify-center text-[#a1a1a1] text-xs font-bold">
                          +{project.members.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/projects/${project.id}/team`);
                }}
                className="w-full mt-4 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-sm font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Open Team Chat</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#ededed] mb-4">About Team Collaboration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="w-10 h-10 bg-orange-900/20 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#ededed] mb-1">Invite Team Members</h3>
            <p className="text-xs text-[#6b6b6b]">
              Add collaborators to your projects with role-based access control
            </p>
          </div>
          <div>
            <div className="w-10 h-10 bg-blue-900/20 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#ededed] mb-1">Real-time Chat</h3>
            <p className="text-xs text-[#6b6b6b]">
              Communicate with your team instantly using project-level chat
            </p>
          </div>
          <div>
            <div className="w-10 h-10 bg-green-900/20 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#ededed] mb-1">Secure Access</h3>
            <p className="text-xs text-[#6b6b6b]">
              Admin, Editor, and Viewer roles with Row Level Security protection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

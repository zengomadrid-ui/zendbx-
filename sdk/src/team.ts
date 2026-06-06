import type { HttpClient } from './http';
import type { ZendbxResponse, TeamMember } from './types';

export class TeamModule {
  constructor(
    private http: HttpClient,
    private projectId: string
  ) {}

  /** List all team members */
  async list(): Promise<ZendbxResponse<TeamMember[]>> {
    return this.http.request<TeamMember[]>(
      `/api/projects/${this.projectId}/team/members`
    );
  }

  /** Invite a team member by email */
  async invite(
    email: string,
    role: TeamMember['role'] = 'member'
  ): Promise<ZendbxResponse<TeamMember>> {
    return this.http.request<TeamMember>(
      `/api/projects/${this.projectId}/team/members`,
      { method: 'POST', body: { email, role } }
    );
  }

  /** Update a team member's role */
  async updateRole(
    memberId: string,
    role: TeamMember['role']
  ): Promise<ZendbxResponse<TeamMember>> {
    return this.http.request<TeamMember>(
      `/api/projects/${this.projectId}/team/members/${memberId}`,
      { method: 'PUT', body: { role } }
    );
  }

  /** Remove a team member */
  async remove(memberId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${this.projectId}/team/members/${memberId}`,
      { method: 'DELETE' }
    );
  }
}

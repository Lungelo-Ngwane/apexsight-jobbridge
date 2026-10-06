import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { MoreVertical, Users, Star, CheckCircle, Eye } from "lucide-react";
export interface DashboardJob { id: string; title: string; status: string; employment_type: string | null; location: string | null; created_at: string; view_count?: number | null; job_applications?: Array<{ status?: string }> | null; }
export function EmployerDashboardJobCard({job, menuOpen, onToggleMenu, onDismissMenu, onViewCandidates, onEdit, onOpenJobs, onCloseJob, onReport}: { job: DashboardJob; menuOpen: boolean; onToggleMenu: () => void; onDismissMenu: () => void; onViewCandidates: () => void; onEdit: () => void; onOpenJobs: () => void; onCloseJob: () => void; onReport: () => void; }) { return (
                <Card
                  className="p-6 border-gray-200 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-neutral-950 dark:hover:shadow-black/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {job.title}
                        </h3>
                        <Badge className="bg-green-100 text-green-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {job.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{job.employment_type ?? "—"}</span>
                        <span>•</span>
                        <span>{job.location ?? "Remote"}</span>
                        <span>•</span>
                        <span>
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                    </div>

                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${job.title}`}
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleMenu();
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      {menuOpen && (
                        <div
                          className="absolute right-0 top-12 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-neutral-900"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Job Actions
                          </p>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                            onClick={() => {
                              onViewCandidates();
                              onDismissMenu();
                            }}
                          >
                            View candidates
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                            onClick={() => {
                              onEdit();
                              onDismissMenu();
                            }}
                          >
                            Edit job
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                            onClick={() => {
                              onOpenJobs();
                              onDismissMenu();
                            }}
                          >
                            Open jobs page
                          </button>
                          <div className="my-1 h-px bg-gray-200 dark:bg-white/10" />
                          <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                            onClick={() => {
                              onCloseJob();
                              onDismissMenu();
                            }}
                          >
                            Close job
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-medium">Applicants</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{job.job_applications?.length ?? 0}</div>
                    </div>
                    
                    
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-400/15 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-amber-600 dark:text-amber-300">
                        <Star className="w-4 h-4" />
                        <span className="text-xs font-medium">Shortlisted</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{job.job_applications?.filter(
                        (a: { status?: string }) => a.status === "shortlisted"
                      ).length ?? 0}</div>
                    </div>

                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-400/15 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Interviewed</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{job.job_applications?.filter(
                        (a: { status?: string }) => a.status === "interview"
                      ).length ?? 0}</div>
                    </div>

                    <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 dark:border-violet-400/15 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-violet-600 dark:text-violet-300">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-medium">Views</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{job.view_count ?? 0}</div>
                    </div>

                    
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={onViewCandidates}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Candidates
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onReport}
                    >
                      AI Hiring Report
                    </Button>
                  </div>
                </Card>

); }

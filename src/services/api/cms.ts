import { api } from "./client";

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_description: string | null;
  published_at: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
}

export interface CareerPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  is_active: boolean;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  total_deliveries: number;
  routes_count: number;
  avg_rating: string;
  formatted: {
    total_users: string;
    total_deliveries: string;
    routes_count: string;
    avg_rating: string;
  };
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  text: string;
  avatar_initials: string;
  rating: number;
  is_featured: boolean;
  created_at: string;
}

export const cmsApi = {
  getStats: () => api.get<PlatformStats>("/cms-handler/stats"),

  getTestimonials: () => api.get<Testimonial[]>("/cms-handler/testimonials"),

  getPage: (slug: string) => api.get<CmsPage>(`/cms-handler/pages/${slug}`),

  listBlogPosts: (params?: { category?: string; page?: number; per_page?: number }) =>
    api.get<BlogPost[]>("/cms-handler/blog", params),

  getBlogPost: (slug: string) => api.get<BlogPost>(`/cms-handler/blog/${slug}`),

  listCareers: () => api.get<CareerPosition[]>("/cms-handler/careers"),

  getCareerPosition: (id: string) => api.get<CareerPosition>(`/cms-handler/careers/${id}`),

  submitContact: (data: { name: string; email: string; subject: string; message: string }) =>
    api.post<{ submitted: boolean }>("/cms-handler/contact", data),

  joinWaitlist: (email: string, role_interest?: string) =>
    api.post<{ subscribed: boolean }>("/cms-handler/waitlist", { email, role_interest }),
};

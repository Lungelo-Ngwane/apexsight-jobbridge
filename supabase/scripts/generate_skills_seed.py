import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def norm(value: str) -> str:
    value = value.strip()
    value = re.sub(r"\s+", " ", value)
    return value


def add_skill(skills: Dict[str, Optional[str]], name: str, category: Optional[str]) -> None:
    name = norm(name)
    category = norm(category) if category else None
    if not name:
        return
    if len(name) > 150:
        name = name[:150]
    if category and len(category) > 100:
        category = category[:100]
    skills[name] = category


def add_many(skills: Dict[str, Optional[str]], names: List[str], category: Optional[str]) -> None:
    for name in names:
        add_skill(skills, name, category)


def cloud_service_pack(prefix: str, services: List[str]) -> List[str]:
    return [f"{prefix} {service}" for service in services]


def add_combo(
    skills: Dict[str, Optional[str]],
    category: str,
    prefixes: List[str],
    items: List[str],
) -> None:
    for prefix in prefixes:
        for item in items:
            add_skill(skills, f"{prefix} {item}", category)


def build_skills() -> Dict[str, Optional[str]]:
    skills: Dict[str, Optional[str]] = {}

    add_many(
        skills,
        [
            "JavaScript",
            "TypeScript",
            "Python",
            "Java",
            "Kotlin",
            "Swift",
            "Objective-C",
            "Go",
            "Rust",
            "C",
            "C++",
            "C#",
            "PHP",
            "Ruby",
            "Scala",
            "R",
            "Dart",
            "Elixir",
            "Haskell",
            "Lua",
            "Perl",
            "Julia",
            "Groovy",
            "PowerShell",
            "Bash",
            "Shell Scripting",
            "MATLAB",
            "VB.NET",
            "Assembly",
            "SQL",
            "T-SQL",
            "PL/pgSQL",
            "Solidity",
        ],
        "Programming Language",
    )

    add_many(
        skills,
        [
            "React",
            "Next.js",
            "Remix",
            "Gatsby",
            "Vue.js",
            "Nuxt",
            "Angular",
            "Svelte",
            "SvelteKit",
            "SolidJS",
            "Qwik",
            "Ember.js",
            "Backbone.js",
            "jQuery",
            "Web Components",
            "Lit",
            "Stencil",
            "Redux",
            "Redux Toolkit",
            "Zustand",
            "MobX",
            "Recoil",
            "XState",
            "TanStack Query",
            "React Query",
            "RTK Query",
            "SWR",
            "React Hook Form",
            "Formik",
            "Zod",
            "Yup",
            "Webpack",
            "Vite",
            "Rollup",
            "Parcel",
            "Babel",
            "ESBuild",
            "Storybook",
            "Chromatic",
            "Module Federation",
            "Tailwind CSS",
            "Bootstrap",
            "Material UI",
            "Chakra UI",
            "Ant Design",
            "Radix UI",
            "Shadcn UI",
            "Styled Components",
            "Emotion",
            "Sass",
            "Less",
            "PostCSS",
            "Accessibility (a11y)",
            "Performance Optimization",
            "Core Web Vitals",
            "PWA (Progressive Web Apps)",
            "Service Workers",
            "Three.js",
            "WebGL",
            "D3.js",
            "Chart.js",
            "ECharts",
            "Highcharts",
            "Framer Motion",
            "GSAP",
        ],
        "Frontend",
    )

    add_many(
        skills,
        [
            "Node.js",
            "Express.js",
            "NestJS",
            "Fastify",
            "Koa.js",
            "Hapi",
            "Django",
            "Flask",
            "FastAPI",
            "Spring Boot",
            "Micronaut",
            "Quarkus",
            "ASP.NET Core",
            ".NET",
            "Entity Framework",
            "Ruby on Rails",
            "Sinatra",
            "Laravel",
            "Symfony",
            "GraphQL",
            "Apollo GraphQL",
            "GraphQL Yoga",
            "Hasura",
            "PostgREST",
            "tRPC",
            "REST API Development",
            "OpenAPI / Swagger",
            "gRPC",
            "WebSockets",
            "Microservices",
            "Monolith Architecture",
            "Serverless Architecture",
            "Event-Driven Architecture",
            "CQRS",
            "Event Sourcing",
            "Authentication",
            "Authorization",
            "Rate Limiting",
            "Caching",
        ],
        "Backend",
    )

    add_many(
        skills,
        [
            "PostgreSQL",
            "MySQL",
            "MariaDB",
            "SQLite",
            "Microsoft SQL Server",
            "Oracle Database",
            "MongoDB",
            "Redis",
            "Elasticsearch",
            "OpenSearch",
            "Cassandra",
            "CouchDB",
            "Neo4j",
            "DynamoDB",
            "Firebase",
            "Firestore",
            "Supabase",
            "BigQuery",
            "Snowflake",
            "Redshift",
            "Databricks",
            "TimescaleDB",
            "CockroachDB",
            "ClickHouse",
            "InfluxDB",
            "Prometheus TSDB",
            "Prisma",
            "TypeORM",
            "Sequelize",
            "Drizzle ORM",
            "SQLAlchemy",
            "Mongoose",
            "Database Design",
            "Data Modeling",
            "Query Optimization",
            "Indexing",
            "Replication",
            "Sharding",
        ],
        "Database",
    )

    add_many(
        skills,
        [
            "Docker",
            "Docker Compose",
            "Kubernetes",
            "Helm",
            "Kustomize",
            "Terraform",
            "Pulumi",
            "Ansible",
            "Chef",
            "Puppet",
            "Linux",
            "Ubuntu",
            "Debian",
            "CentOS",
            "Red Hat",
            "Nginx",
            "Apache",
            "HAProxy",
            "CI/CD",
            "GitHub Actions",
            "GitLab CI/CD",
            "Jenkins",
            "CircleCI",
            "Travis CI",
            "Azure DevOps Pipelines",
            "ArgoCD",
            "FluxCD",
            "Monitoring",
            "Logging",
            "Observability",
            "OpenTelemetry",
            "Prometheus",
            "Grafana",
            "Loki",
            "Tempo",
            "Jaeger",
            "Sentry",
            "Datadog",
            "New Relic",
            "Splunk",
            "Load Testing",
            "Performance Testing",
            "Chaos Engineering",
        ],
        "DevOps",
    )

    add_many(
        skills,
        [
            "Amazon Web Services (AWS)",
            "Microsoft Azure",
            "Google Cloud Platform (GCP)",
            "DigitalOcean",
            "Cloudflare",
            "Vercel",
            "Netlify",
            "Render",
            "Railway",
            "Heroku",
        ],
        "Cloud",
    )

    aws_services = [
        "Lambda",
        "EC2",
        "ECS",
        "EKS",
        "Fargate",
        "S3",
        "CloudFront",
        "Route 53",
        "RDS",
        "DynamoDB",
        "Aurora",
        "SQS",
        "SNS",
        "EventBridge",
        "API Gateway",
        "CloudWatch",
        "CloudTrail",
        "IAM",
        "KMS",
        "Secrets Manager",
        "Cognito",
        "CloudFormation",
        "CDK",
        "ElastiCache",
        "Redshift",
        "Athena",
        "Glue",
        "EMR",
    ]
    azure_services = [
        "Functions",
        "App Service",
        "AKS",
        "Container Apps",
        "VMs",
        "Blob Storage",
        "Cosmos DB",
        "SQL Database",
        "Key Vault",
        "Application Insights",
        "Monitor",
        "Event Grid",
        "Service Bus",
        "Logic Apps",
        "AD (Entra ID)",
    ]
    gcp_services = [
        "Cloud Run",
        "Compute Engine",
        "GKE",
        "Cloud Functions",
        "Cloud Storage",
        "BigQuery",
        "Pub/Sub",
        "Cloud SQL",
        "Firestore",
        "Secret Manager",
        "Cloud Build",
        "Cloud Logging",
        "Cloud Monitoring",
        "IAM",
    ]

    add_many(skills, cloud_service_pack("AWS", aws_services), "Cloud")
    add_many(skills, cloud_service_pack("Azure", azure_services), "Cloud")
    add_many(skills, cloud_service_pack("GCP", gcp_services), "Cloud")
    add_many(
        skills,
        cloud_service_pack("Cloudflare", ["Workers", "Pages", "R2", "WAF", "DNS", "CDN", "Zero Trust"]),
        "Cloud",
    )

    add_many(
        skills,
        [
            "Cybersecurity",
            "Application Security",
            "Secure Coding",
            "OWASP",
            "OWASP Top 10",
            "Threat Modeling",
            "Penetration Testing",
            "Vulnerability Management",
            "SIEM",
            "SOAR",
            "Incident Response",
            "IAM (Identity and Access Management)",
            "SSO",
            "SAML",
            "OAuth 2.0",
            "OpenID Connect",
            "JWT",
            "Encryption",
            "PKI",
            "TLS/SSL",
            "Key Management",
            "WAF",
            "DDoS Protection",
            "Zero Trust",
            "Network Security",
            "Firewall Management",
            "SOC Operations",
            "Security Auditing",
            "Compliance",
            "Risk Management",
        ],
        "Security",
    )

    add_many(
        skills,
        [
            "Data Analysis",
            "Data Engineering",
            "ETL",
            "ELT",
            "Data Warehousing",
            "Data Visualization",
            "Business Intelligence",
            "Pandas",
            "NumPy",
            "Apache Spark",
            "Hadoop",
            "Airflow",
            "dbt",
            "Kafka Streams",
            "Machine Learning",
            "Deep Learning",
            "TensorFlow",
            "PyTorch",
            "Scikit-learn",
            "XGBoost",
            "Natural Language Processing",
            "Computer Vision",
            "Prompt Engineering",
            "LLM Engineering",
            "OpenAI API",
            "RAG (Retrieval-Augmented Generation)",
            "Embeddings",
            "Vector Databases",
            "LangChain",
            "LlamaIndex",
            "Pinecone",
            "Weaviate",
            "Chroma",
            "Milvus",
        ],
        "AI/ML",
    )

    add_many(
        skills,
        [
            "Unit Testing",
            "Integration Testing",
            "End-to-End Testing",
            "Test Automation",
            "Jest",
            "Vitest",
            "Mocha",
            "Chai",
            "Cypress",
            "Playwright",
            "Selenium",
            "Postman",
            "Newman",
            "Contract Testing",
            "Pact",
            "TDD",
            "BDD",
        ],
        "QA",
    )

    add_many(
        skills,
        [
            "Android Development",
            "iOS Development",
            "React Native",
            "Expo",
            "Flutter",
            "SwiftUI",
            "Jetpack Compose",
            "Kotlin Multiplatform",
            "Xamarin",
            ".NET MAUI",
        ],
        "Mobile",
    )

    add_many(
        skills,
        [
            "Figma",
            "UI Design",
            "UX Design",
            "Design Systems",
            "Wireframing",
            "Prototyping",
            "User Research",
            "Usability Testing",
            "Information Architecture",
        ],
        "Design",
    )

    add_many(
        skills,
        [
            "Agile",
            "Scrum",
            "Kanban",
            "Product Management",
            "Project Management",
            "Stakeholder Management",
            "Jira",
            "Confluence",
            "Notion",
            "Roadmapping",
            "Technical Writing",
            "Documentation",
        ],
        "Product",
    )

    add_many(
        skills,
        [
            "IT Support",
            "Service Desk",
            "Helpdesk",
            "Troubleshooting",
            "Hardware Support",
            "Software Support",
            "Windows",
            "Windows Server",
            "Linux Administration",
            "Active Directory",
            "Group Policy",
            "Networking",
            "TCP/IP",
            "DNS",
            "DHCP",
            "VPN",
            "Wi-Fi",
            "VLANs",
            "Routing",
            "Switching",
            "Network Monitoring",
            "Backup and Recovery",
            "Disaster Recovery",
            "Virtualization",
            "VMware",
            "Hyper-V",
        ],
        "IT",
    )

    add_many(
        skills,
        [
            "System Design",
            "Software Architecture",
            "Design Patterns",
            "Clean Architecture",
            "Domain-Driven Design (DDD)",
            "Distributed Systems",
            "Scalability",
            "High Availability",
            "SLA/SLO/SLI",
            "Reliability Engineering",
            "Performance Engineering",
            "API Security",
            "API Gateway",
            "Message Queues",
            "Caching Strategies",
            "Database Transactions",
        ],
        "Architecture",
    )

    add_combo(
        skills,
        "DevOps",
        [
            "Linux",
            "Kubernetes",
            "Docker",
            "Terraform",
            "Ansible",
            "GitHub Actions",
            "GitLab CI/CD",
            "Jenkins",
            "ArgoCD",
            "Prometheus",
            "Grafana",
        ],
        [
            "setup",
            "administration",
            "troubleshooting",
            "hardening",
            "best practices",
            "monitoring",
            "alerting",
            "automation",
        ],
    )

    add_combo(
        skills,
        "Security",
        ["OAuth", "OpenID Connect", "SAML", "TLS", "PKI", "WAF", "SIEM", "Incident Response", "IAM", "Zero Trust"],
        ["implementation", "configuration", "troubleshooting", "best practices"],
    )

    add_combo(
        skills,
        "Database",
        ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL Server", "Oracle", "Snowflake", "BigQuery", "DynamoDB"],
        ["backup", "replication", "tuning", "indexing", "migration", "monitoring", "high availability"],
    )

    add_combo(
        skills,
        "Frontend",
        ["React", "Next.js", "Angular", "Vue.js", "TypeScript", "Tailwind CSS", "Storybook", "Webpack", "Vite"],
        ["architecture", "performance", "testing", "accessibility", "state management", "component design", "best practices"],
    )

    add_combo(
        skills,
        "Backend",
        ["Node.js", "NestJS", "Spring Boot", "Django", "FastAPI", "ASP.NET Core", "GraphQL", "gRPC"],
        ["API development", "security", "testing", "performance", "deployment", "best practices"],
    )

    add_many(
        skills,
        [
            "AWS Certified Cloud Practitioner",
            "AWS Certified Solutions Architect",
            "AWS Certified Developer",
            "Azure Fundamentals (AZ-900)",
            "Azure Developer Associate",
            "Azure Solutions Architect Expert",
            "Google Associate Cloud Engineer",
            "CompTIA A+",
            "CompTIA Network+",
            "CompTIA Security+",
            "ITIL Foundation",
            "Cisco CCNA",
            "Cisco CCNP",
        ],
        "Certification",
    )

    add_many(
        skills,
        [
            "Stripe",
            "Paystack",
            "Twilio",
            "Resend",
            "SendGrid",
            "Mailgun",
            "Supabase Auth",
            "PostgreSQL RLS",
            "Row Level Security (RLS)",
            "DigitalOcean App Platform",
            "Docker Swarm",
            "NGINX Ingress",
            "Traefik",
            "RabbitMQ",
            "Apache Kafka",
            "Apache Pulsar",
            "Redis Pub/Sub",
            "WebRTC",
            "Socket.IO",
        ],
        "Platform",
    )

    add_many(
        skills,
        [
            "Microsoft 365",
            "Microsoft Teams",
            "Microsoft Entra ID",
            "Azure Active Directory",
            "Intune",
            "Microsoft Defender",
            "SharePoint",
            "SharePoint Online",
            "SharePoint Administration",
            "SharePoint Framework (SPFx)",
            "Power Platform",
            "Power Apps",
            "Power Automate",
            "Power BI",
            "Power BI DAX",
            "Power BI Data Modeling",
            "Power Query",
            "Dataverse",
            "Dynamics 365",
            "Dynamics 365 CRM",
            "Dynamics 365 Finance and Operations",
            "Microsoft Fabric",
            "Azure Data Factory",
            "Azure Synapse Analytics",
            "Azure Data Lake Storage",
            "Azure Logic Apps",
            "Azure Service Bus",
            "Azure Event Grid",
            "Microsoft Sentinel",
            "Windows 11",
            "Windows 10",
            "Exchange Online",
            "OneDrive for Business",
            "Planner",
            "Microsoft Project",
            "Microsoft Visio",
            "Excel",
            "Advanced Excel",
            "PivotTables",
            "Power Pivot",
            "VBA",
            "Office 365 Administration",
            "M365 Security",
            "M365 Compliance",
            "M365 Identity Management",
        ],
        "Microsoft",
    )

    return skills


def to_sql(skills: Dict[str, Optional[str]], max_rows: int = 3000, min_rows: int = 1) -> str:
    items: List[Tuple[str, Optional[str]]] = sorted(skills.items(), key=lambda x: x[0].lower())
    if len(items) < min_rows:
        raise RuntimeError(f"Only generated {len(items)} skills. Increase expanders.")
    if len(items) > max_rows:
        items = items[:max_rows]

    rows: List[str] = []
    for name, category in items:
        jname = name.replace("\\", "\\\\").replace('"', '\\"')
        jcat = (category or "").replace("\\", "\\\\").replace('"', '\\"')
        rows.append(f'{{"name":"{jname}","category":"{jcat}"}}')

    json_payload = "[\n  " + ",\n  ".join(rows) + "\n]"
    # SQL literal escaping for payload that may contain apostrophes.
    json_payload_sql = json_payload.replace("'", "''")

    return f"""-- Auto-generated skills seed ({len(items)} skills)
-- Safe to re-run. Does not require a unique constraint on skills.name.

with payload as (
  select '{json_payload_sql}'::jsonb as data
),
rows as (
  select
    left(r.name, 150)::varchar(150) as name,
    nullif(left(r.category, 100), '')::varchar(100) as category
  from payload,
  jsonb_to_recordset(payload.data) as r(name text, category text)
),
updated as (
  update public.skills s
  set category = rows.category
  from rows
  where lower(s.name) = lower(rows.name)
  returning lower(s.name) as norm_name
)
insert into public.skills (name, category)
select rows.name, rows.category
from rows
where not exists (
  select 1 from updated u where u.norm_name = lower(rows.name)
)
and not exists (
  select 1 from public.skills s where lower(s.name) = lower(rows.name)
);
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a skills seed SQL file for Supabase.")
    parser.add_argument(
        "--output",
        default="supabase/seed/skills_seed.sql",
        help="Output SQL file path",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=3000,
        help="Maximum number of skills to include",
    )
    parser.add_argument(
        "--min-rows",
        type=int,
        default=1,
        help="Minimum required number of generated skills before failing",
    )
    args = parser.parse_args()

    skills = build_skills()
    sql = to_sql(skills, max_rows=args.max_rows, min_rows=args.min_rows)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(sql, encoding="utf-8")
    print(f"Generated {output_path} with {len(skills)} source skills")


if __name__ == "__main__":
    main()

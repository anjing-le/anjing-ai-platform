import { X } from "lucide-react";
import { useEffect, type FormEvent } from "react";

export type ActionMode = "iam" | "gateway" | "quota" | "docs";

export type ActionValues = Record<string, string>;

type SelectOption = string | { label: string; value: string };

interface ActionDialogProps {
  busy: boolean;
  error: string;
  mode: ActionMode;
  onClose: () => void;
  onSubmit: (values: ActionValues) => Promise<void>;
}

const actionCopy: Record<
  ActionMode,
  {
    title: string;
    description: string;
    submit: string;
    fields: Array<
      | {
          kind: "input";
          label: string;
          name: string;
          placeholder: string;
          help?: string;
          required?: boolean;
          span?: "full";
          type?: string;
        }
      | {
          kind: "select";
          label: string;
          name: string;
          options: SelectOption[];
          help?: string;
          required?: boolean;
          span?: "full";
        }
    >;
  }
> = {
  iam: {
    title: "邀请用户",
    description: "创建一个平台用户，后续会进入 API Key、角色和凭据配置流程。",
    submit: "发送邀请",
    fields: [
      {
        kind: "input",
        label: "Email",
        name: "email",
        placeholder: "new.user@anjing.ai",
        required: true,
        type: "email",
      },
      {
        kind: "input",
        label: "组织",
        name: "org",
        placeholder: "工程团队",
        required: true,
      },
      {
        kind: "select",
        label: "角色",
        name: "role",
        options: ["使用用户", "开发人员", "运维人员", "管理员"],
        required: true,
      },
    ],
  },
  gateway: {
    title: "新增路由",
    description: "创建一条统一入口路由，并同时声明负载策略、权重和灰度规则。",
    submit: "创建路由",
    fields: [
      {
        kind: "input",
        label: "Route",
        name: "route",
        placeholder: "/api/v1/agents/**",
        help: "对外暴露的 API 路径，支持 V1 通配符。",
        required: true,
        span: "full",
      },
      {
        kind: "input",
        label: "Upstream",
        name: "upstream",
        placeholder: "https://primary.internal, https://fallback.internal",
        help: "一个或多个 http/https 上游，多个候选用逗号、分号或换行分隔。",
        required: true,
        span: "full",
      },
      {
        kind: "input",
        label: "Limit",
        name: "limit",
        placeholder: "600/min",
        required: true,
      },
      {
        kind: "select",
        label: "Strategy",
        name: "strategy",
        options: [
          { label: "Ordered · 主上游优先", value: "ordered" },
          { label: "Round robin · 轮询", value: "round_robin" },
          { label: "Weighted · 权重", value: "weighted" },
        ],
        required: true,
      },
      {
        kind: "input",
        label: "Weights",
        name: "upstreamWeights",
        placeholder: "https://primary.internal=80, https://fallback.internal=20",
        help: "仅 Weighted 策略使用；key 必须和 Upstream 候选完全一致。",
        span: "full",
      },
      {
        kind: "input",
        label: "Canary Header",
        name: "canaryHeader",
        placeholder: "X-Release-Cohort",
        help: "填写后，命中该 header 的请求会优先走 Canary Upstream。",
      },
      {
        kind: "input",
        label: "Canary Value",
        name: "canaryValue",
        placeholder: "beta",
        help: "可选；留空表示 header 非空即可命中。",
      },
      {
        kind: "input",
        label: "Canary Upstream",
        name: "canaryUpstream",
        placeholder: "https://canary.internal",
        help: "启用灰度时必填，必须是可代理的 http/https 地址。",
        span: "full",
      },
    ],
  },
  quota: {
    title: "新增套餐",
    description: "创建一组配额规则，先服务接入演示，后续接入真实计费周期。",
    submit: "创建套餐",
    fields: [
      {
        kind: "input",
        label: "套餐名",
        name: "name",
        placeholder: "Team",
        required: true,
      },
      {
        kind: "input",
        label: "RPS",
        name: "rps",
        placeholder: "300",
        required: true,
      },
      {
        kind: "input",
        label: "Token / day",
        name: "tokenPerDay",
        placeholder: "2M",
        required: true,
      },
    ],
  },
  docs: {
    title: "创建接入应用",
    description: "创建一个应用主体，生成默认 API Key 引用，并把它纳入网关、用量和接入校验流程。",
    submit: "创建应用",
    fields: [
      {
        kind: "input",
        label: "应用名",
        name: "name",
        placeholder: "agent-workbench",
        required: true,
      },
      {
        kind: "input",
        label: "Owner",
        name: "owner",
        placeholder: "owner@anjing.ai",
        required: true,
        type: "email",
      },
      {
        kind: "select",
        label: "环境",
        name: "environment",
        options: ["Sandbox", "Production"],
        required: true,
      },
      {
        kind: "input",
        label: "默认路由",
        name: "defaultRoute",
        placeholder: "/api/v1/llm/**",
        required: true,
      },
      {
        kind: "select",
        label: "套餐",
        name: "plan",
        options: ["Free", "Business"],
        required: true,
      },
    ],
  },
};

export function ActionDialog({ busy, error, mode, onClose, onSubmit }: ActionDialogProps) {
  const copy = actionCopy[mode];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: ActionValues = {};

    for (const [key, value] of formData.entries()) {
      values[key] = String(value);
    }

    await onSubmit(values);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-describedby="action-dialog-description"
        aria-labelledby="action-dialog-title"
        aria-modal="true"
        className={`action-dialog action-dialog--${mode}`}
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow">Action</p>
            <h2 id="action-dialog-title">{copy.title}</h2>
            <p id="action-dialog-description">{copy.description}</p>
          </div>
          <button aria-label="关闭" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <form aria-busy={busy} className={`action-form action-form--${mode}`} onSubmit={handleSubmit}>
          {copy.fields.map((field, index) => (
            <label className={field.span === "full" ? "action-form__field action-form__field--full" : "action-form__field"} key={field.name}>
              <span>{field.label}</span>
              {field.kind === "input" ? (
                <input
                  autoFocus={index === 0}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  type={field.type || "text"}
                />
              ) : (
                <select autoFocus={index === 0} name={field.name} required={field.required}>
                  {field.options.map((option) => (
                    <option key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
                      {typeof option === "string" ? option : option.label}
                    </option>
                  ))}
                </select>
              )}
              {field.help ? <small>{field.help}</small> : null}
            </label>
          ))}

          {error ? (
            <p aria-live="polite" className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer>
            <button className="button" disabled={busy} onClick={onClose} type="button">
              取消
            </button>
            <button aria-live="polite" className="button button--primary" disabled={busy} type="submit">
              {busy ? "提交中" : copy.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

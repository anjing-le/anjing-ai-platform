import { X } from "lucide-react";
import type { FormEvent } from "react";

export type ActionMode = "iam" | "gateway" | "quota" | "docs";

export type ActionValues = Record<string, string>;

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
          required?: boolean;
          type?: string;
        }
      | {
          kind: "select";
          label: string;
          name: string;
          options: string[];
          required?: boolean;
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
        placeholder: "Engineering",
        required: true,
      },
      {
        kind: "select",
        label: "角色",
        name: "role",
        options: ["User", "Developer", "Operator", "Administrator"],
        required: true,
      },
    ],
  },
  gateway: {
    title: "新增路由",
    description: "先创建一条 API gateway 路由，后续再接模型路由、限流和鉴权策略。",
    submit: "创建路由",
    fields: [
      {
        kind: "input",
        label: "Route",
        name: "route",
        placeholder: "/api/v1/agents/**",
        required: true,
      },
      {
        kind: "input",
        label: "Upstream",
        name: "upstream",
        placeholder: "gateway-api",
        required: true,
      },
      {
        kind: "input",
        label: "Limit",
        name: "limit",
        placeholder: "600/min",
        required: true,
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
      <section aria-labelledby="action-dialog-title" aria-modal="true" className="action-dialog" role="dialog">
        <header>
          <div>
            <p className="eyebrow">Action</p>
            <h2 id="action-dialog-title">{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <form className="action-form" onSubmit={handleSubmit}>
          {copy.fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              {field.kind === "input" ? (
                <input
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  type={field.type || "text"}
                />
              ) : (
                <select name={field.name} required={field.required}>
                  {field.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              )}
            </label>
          ))}

          {error ? <p className="form-error">{error}</p> : null}

          <footer>
            <button className="button" disabled={busy} onClick={onClose} type="button">
              取消
            </button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy ? "提交中" : copy.submit}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

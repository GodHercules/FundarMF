declare module "mjml" {
  type MjmlOptions = {
    validationLevel?: "strict" | "soft" | "skip";
  };
  type MjmlResult = {
    html: string;
    errors: Array<{ message: string }>;
  };
  export default function mjml2html(input: string, options?: MjmlOptions): MjmlResult;
}

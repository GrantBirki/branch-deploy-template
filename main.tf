terraform {
  required_version = "= 1.16.4"

  backend "local" {}
}

variable "revision" {
  description = "The exact revision represented by this local demonstration."
  type        = string
  default     = "local"

  validation {
    condition     = var.revision == "local" || can(regex("^[0-9a-f]{40}([0-9a-f]{24})?$", var.revision))
    error_message = "revision must be 'local' or an exact 40- or 64-character lowercase Git SHA."
  }
}

resource "terraform_data" "example" {
  input = {
    repository = "branch-deploy-template"
    revision   = var.revision
  }
}

output "deployment_receipt" {
  description = "The harmless value recorded in local state for acceptance checks."
  value       = terraform_data.example.output
}

output "deployed_revision" {
  description = "The exact revision recorded by the demonstration resource."
  value       = terraform_data.example.output.revision
}

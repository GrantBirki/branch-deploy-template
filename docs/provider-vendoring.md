# Vendoring external Terraform providers

This template needs no provider mirror or dependency lock file. `terraform_data` is built into Terraform, so adding an empty `vendor/` directory or lock file now would be ceremony without a dependency to protect.

The noop/deploy scripts initialize with an empty provider directory, disable module installation, and reject provider lock files. Bootstrap, lint, and test use ordinary backend-disabled initialization with the caller's Terraform CLI configuration. Change the trusted deployment controls deliberately when introducing a reviewed provider mirror.

If you adapt the template to use an external provider, make provider installation an explicit, reviewed supply-chain change. A practical flow is:

1. Declare the provider source and an exact version in `required_providers`.
2. Run `terraform init`, then use [`terraform providers lock`](https://developer.hashicorp.com/terraform/cli/commands/providers/lock) with one `-platform` argument for every supported local and CI platform. Review the reported signer and commit `.terraform.lock.hcl`.
3. Use [`terraform providers mirror`](https://developer.hashicorp.com/terraform/cli/commands/providers/mirror) with the same platforms to generate `vendor/terraform/providers/` from the lock file. Do not hand-edit provider archives or mirror indexes.
4. Commit the version constraint, `.terraform.lock.hcl`, and the matching `vendor/` change together. Review the provider source, version, checksums, signer, license, and archive contents as deliberately as source code.
5. Add a checked-in Terraform CLI configuration that selects the [`filesystem_mirror`](https://developer.hashicorp.com/terraform/cli/config/config-file#provider-installation). Omit `direct` installation for routine use so a missing provider or platform fails closed instead of reaching the registry. Set `TF_CLI_CONFIG_FILE` in the shared scripts so local and CI runs use the same policy.
6. Prove the real `terraform init`, tests, noop, and deploy paths work with registry access disabled and verify the mirrored packages against the lock file. Keep the networked lock-and-mirror refresh as a separate, intentional dependency-update process.

For example, a project supporting GitHub-hosted Linux runners and both current Mac architectures would lock and mirror `linux_amd64`, `darwin_amd64`, and `darwin_arm64`. Only include platforms the project actually supports. When `vendor/` exists, mark its third-party archives as vendored or binary in `.gitattributes` so repository tooling does not treat them as project source.

The [dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock) records selected provider versions and package checksums. It does not contain provider archives. The mirror contains the platform-specific archives. Commit and review both; regenerating one without the other should fail validation.

Candidate packages and candidate checksums are not independent provenance. Before loading a provider, trusted tooling must verify it against protected dependency policy or independently authenticated release evidence for an approved candidate commit. Keep routine installation readonly with `-lockfile=readonly`, and fail on missing packages instead of falling back to registry downloads. See [provider integrity](https://github.com/GrantBirki/branch-deploy/blob/main/docs/security_hardening_guides/terraform-plans.md#providers-are-executable-dependencies).

A checked-in mirror is vendoring, not an Actions cache. It makes routine provider installation reproducible and available offline, but it does not make the whole Terraform run hermetic. The Terraform CLI, remote modules, backend, state, external programs, credentials, and provider API calls remain separate inputs. Pin or remove those inputs according to the repository's actual threat model, and do not describe a build as hermetic until routine execution has no undeclared network or host dependencies. [Hermetic Builds](https://software.birki.io/posts/hermetic-builds/) explains the broader goal.

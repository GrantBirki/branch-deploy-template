run "records_the_selected_revision" {
  command = apply

  variables {
    revision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }

  assert {
    condition     = output.deployment_receipt.repository == "branch-deploy-template"
    error_message = "the receipt must identify this template"
  }

  assert {
    condition     = output.deployed_revision == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    error_message = "the receipt must contain the selected exact revision"
  }
}

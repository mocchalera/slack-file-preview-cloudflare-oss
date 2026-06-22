Feature: Slack file preview MVP
  As a Slack user
  I want supported shared files to produce safe thread previews
  So that I can inspect content without exposing private Slack URLs or unsafe HTML

  Scenario: Markdown file produces a safe preview link
    Given a valid Slack file_shared event for a Markdown file
    When the Worker verifies the event and starts the preview Workflow
    Then the app stores preview metadata in D1
    And the app stores safe preview HTML in private R2
    And the app posts a signed preview URL to the Slack thread

  Scenario: HTML file is text-previewed instead of served raw
    Given a valid Slack file_shared event for an HTML file
    When the Workflow renders the preview
    Then executable HTML is not served to the browser
    And the preview response uses a strict Content-Security-Policy

  Scenario: File revocation disables preview access
    Given an active preview exists for a Slack file
    When Slack sends file_deleted or file_unshared for that file
    Then the preview status becomes revoked
    And the preview route stops returning the stored preview body

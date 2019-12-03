pipeline {
  options {
    buildDiscarder(logRotator(daysToKeepStr: '60'))
  }

  agent {
    label 'vetsgov-general-purpose'
  }

  stages {
    stage('Checkout Code') {
      steps {
        checkout scm
      }
    }

    stage('Run saml-proxy tests') {
      agent {
        dockerfile {
          args "--entrypoint='' -u 0:0"
          dir "saml-proxy"
          label 'vetsgov-general-purpose'
        }
      }

      steps {
        sh '''
          cd /opt/app
          npm run test:ci'
        '''
      }
      post {
        always {
          junit 'saml-proxy/test-report.xml'
        }
      }
    }

    stage('Run oauth-proxy tests') {
      agent {
        dockerfile {
          args "--entrypoint='' -u 0:0"
          dir "oauth-proxy"
          label 'vetsgov-general-purpose'
        }
      }

      steps {
        sh '''
          cd /opt/app
          npm run test
        '''
      }
    }

    stage('Deploy dev and staging') {
      when { branch 'master' }

      steps {
        script {
          commit = sh(returnStdout: true, script: "git rev-parse HEAD").trim()
        }

        build job: 'builds/saml-proxy', parameters: [
          booleanParam(name: 'notify_slack', value: true),
          stringParam(name: 'ref', value: commit),
          booleanParam(name: 'release', value: false),
        ], wait: true

        build job: 'deploys/saml-proxy-dvp-dev', parameters: [
          booleanParam(name: 'notify_slack', value: true),
          stringParam(name: 'ref', value: commit),
        ], wait: false

        build job: 'deploys/saml-proxy-dvp-staging', parameters: [
          booleanParam(name: 'notify_slack', value: true),
          stringParam(name: 'ref', value: commit),
        ], wait: false
      }
    }
  }
  post {
    failure {
      script {
        if (env.BRANCH_NAME == 'master') {
          slackSend message: "Failed vets-saml-proxy CI on branch: `${env.BRANCH_NAME}`! ${env.RUN_DISPLAY_URL}".stripMargin(),
            color: 'danger',
            failOnError: true
        }
      }
    }
  }
}

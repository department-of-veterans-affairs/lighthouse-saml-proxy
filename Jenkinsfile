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
          registryUrl 'https://index.docker.io/v1/'
          registryCredentialsId 'vasdvdocker'
          args "--entrypoint='' -u root"
          dir "."
          filename "saml-proxy/Dockerfile"
          label 'vetsgov-general-purpose'
          additionalBuildArgs '--pull'
        }
      }

      steps {
        sh '''
          cd /home/node
          npm run test:ci
        '''
      }
    }

    stage('Run saml-proxy linting') {
      agent {
        dockerfile {
          registryUrl 'https://index.docker.io/v1/'
          registryCredentialsId 'vasdvdocker'
          args "--entrypoint='' -u root"
          dir "."
          filename "saml-proxy/Dockerfile"
          label 'vetsgov-general-purpose'
          additionalBuildArgs '--pull'
        }
      }

      steps {
        sh '''
          cd /home/node
          npm run-script lint
        '''
      }
    }

    stage('Run oauth-proxy tests') {
      agent {
        dockerfile {
          registryUrl 'https://index.docker.io/v1/'
          registryCredentialsId 'vasdvdocker'
          args "--entrypoint='' -u root"
          dir "."
          filename "oauth-proxy/Dockerfile"
          label 'vetsgov-general-purpose'
          additionalBuildArgs '--target base --pull'
        }
      }

      steps {
        sh '''
          cd /home/node
          npm run test
        '''
      }
    }

    stage('Run oauth-proxy linting check') {
      agent {
        dockerfile {
          registryUrl 'https://index.docker.io/v1/'
          registryCredentialsId 'vasdvdocker'
          args "--entrypoint='' -u root"
          dir "."
          filename "oauth-proxy/Dockerfile"
          label 'vetsgov-general-purpose'
          additionalBuildArgs '--target base --pull'
        }
      }

      steps {
        sh '''
          cd /home/node
          npm run-script lint
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

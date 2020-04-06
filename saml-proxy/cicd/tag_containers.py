import argparse
import boto3
from botocore.exceptions import ClientError
import time
import sys


def get_client(service):
    try:
        client = boto3.client(service)
    except ClientError as e:
        print("Error: %s" % e)
        exit(1)
    return client


def get_list_of_builds(client, name):
    paginator = client.get_paginator('list_builds_for_project')
    pages = paginator.paginate(
        projectName=name,
        PaginationConfig={
            'MaxItems': 100
        }
    )
    builds = []
    for page in pages:
        builds += page['ids']
    return builds


def filter_builds(client, builds, id):
    try:
        builds = client.batch_get_builds(
            ids=builds
        )
    except ClientError as e:
        print("Error: %s" % e)
        exit(1)

    for build in builds['builds']:
        if build['resolvedSourceVersion'] == id:
            return build


def get_status(build):
    if build == None:
        print("No build was found.")
        exit(1)
    if build['buildStatus'] == "FAILED" or build['buildStatus'] == "STOPPED":
        print("Build/Push Job failed, was stopped, or didn't exist.")
        exit(1)
    if build['buildStatus'] == "IN_PROGRESS":
        print(".")
        time.sleep(10)
    return build['buildStatus']


def get_image(client, repo, id):
    image = client.batch_get_image(
        repositoryName=repo,
        imageIds=[
            {
                'imageTag': id
            }
        ]
    )
    return image['images']


def tag_image(client, image, repo, version):
    try:
        response = client.put_image(
            repositoryName=repo,
            imageManifest=image[0]['imageManifest'],
            imageTag=version
        )
    except ClientError as e:
        print("Error: %s" % e)
        exit(1)

    return response


def main():
    parser = argparse.ArgumentParser(description='Tag containers in ECR.')
    parser.add_argument('-i', '--id', help='Commit ID of container to tag.')
    parser.add_argument('-r', '--repo', help='Repository name.')
    parser.add_argument('-n', '--name', help="Name of the CI Codebuild job.")
    parser.add_argument('-v', '--version',
                        help="Version number to tag the image with.")

    args = parser.parse_args()

    cb = get_client('codebuild')
    build_list = get_list_of_builds(cb, args.name)
    build = filter_builds(cb, build_list, args.id)

    status = None
    print("Checking build status...")
    while status != "SUCCEEDED":
        status = get_status(filter_builds(cb, [build['id']], args.id))

    ecr = get_client('ecr')
    image = get_image(ecr, args.repo, args.id)
    response = tag_image(ecr, image, args.repo, args.version)
    if response['ResponseMetadata']['HTTPStatusCode'] == 200:
        print("Successfully tagged.")


if __name__ == "__main__":
    main()

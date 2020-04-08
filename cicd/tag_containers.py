import argparse
import boto3
from botocore.exceptions import ClientError
import time
import sys


def get_client(service, file):
    try:
        client = boto3.client(service)
    except ClientError as e:
        print("Error: %s" % e, file=file)
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


def filter_builds(client, builds, id, file):
    try:
        builds = client.batch_get_builds(
            ids=builds
        )
    except ClientError as e:
        print("Error: %s" % e, file=file)
        exit(1)

    for build in builds['builds']:
        if build['resolvedSourceVersion'] == id:
            return build


def get_status(build, file):
    if build == None:
        print("No build was found.", file=file)
        exit(1)
    if build['buildStatus'] == "FAILED" or build['buildStatus'] == "STOPPED":
        print("Build/Push Job failed, was stopped, or didn't exist.", file=file)
        exit(1)
    if build['buildStatus'] == "IN_PROGRESS":
        print(".", file=file)
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


def tag_image(client, image, repo, version, file):
    try:
        response = client.put_image(
            repositoryName=repo,
            imageManifest=image[0]['imageManifest'],
            imageTag=version
        )
    except ClientError as e:
        print("Error: %s" % e, file=file)
        exit(1)

    return response


def main():
    parser = argparse.ArgumentParser(description='Tag containers in ECR.')
    parser.add_argument('-i', '--id', help='Commit ID of container to tag.')
    parser.add_argument('-r', '--repo', help='Repository name.')
    parser.add_argument('-n', '--name', help="Name of the CI Codebuild job.")
    parser.add_argument('-v', '--version',
                        help="Version number to tag the image with.")
    parser.add_argument(
        '-o', '--output', help="Full path to file to write output to.")

    args = parser.parse_args()

    with open(args.output, 'w') as f:
        cb = get_client('codebuild', f)
        build_list = get_list_of_builds(cb, args.name)
        build = filter_builds(cb, build_list, args.id, f)

        status = None
        print("Checking build status...", file=f)
        while status != "SUCCEEDED":
            status = get_status(filter_builds(
                cb, [build['id']], args.id, f), f)

        ecr = get_client('ecr', f)
        image = get_image(ecr, args.repo, args.id)
        response = tag_image(ecr, image, args.repo, args.version, f)
        if response['ResponseMetadata']['HTTPStatusCode'] == 200:
            print("Successfully tagged.", file=f)


if __name__ == "__main__":
    main()

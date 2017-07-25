# Install Docker on Raspian Jessie

```
echo "deb [arch=armhf] https://apt.dockerproject.org/repo raspbian-jessie main" \
| sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get install apt-transport-https
sudo apt-get update
sudo apt-get install docker-engine
```

Optionally, you can add the `pi` user to the `docker` group and avoid having to `sudo docker` commands.

# Build a Docker Container

Build a Docker container with the `docker build` command. Specify custom build arguments as necessary:

```
docker build -t smartthings-node-proxy:latest .
```

Alternately, you can use an already-built image from a public repository on Docker Hub, e.g., https://hub.docker.com/r/tcjennings/rpi-smartthings-nodeproxy/

## Build Arguments

There are a few build arguments you can send to the Docker build process. These are defined in the `Dockerfile` with the `ARG` keyword:

* `node_version`: The version of Node to install. Defaults to 6.11.1.
* `architecture`: The architecture of the cpu. This defaults to `armv6` which is appropriate for any Raspberry Pi. If you have a Pi 3 you can change this to `armv7`.
* `repo` and `branch`: The git repository and branch name from which to fetch the SmartThings Node Proxy code. This defaults to `redloro` and `master`, respectively, but can be changed if you need to build from a fork or a different code branch.
* `build_date`: Defaults to a blank string, can be populated to insert a build date into the resulting Docker image's `LABEL`s.

You can specify any or all of the build arguments on the command line when issuing a docker build command:

```
docker build -t smartthings-node-proxy:latest --build-arg architecture=armv7 \
--build-arg branch=testing --build-arg build_date=$(date -u +”%Y-%m-%dT%H:%M:%SZ”) .
```

# Docker Compose

Use `docker-compose` to execute one or more SmartThings Node Proxy containers. This is easier and more reproducible than performing `docker run` statements.

Edit the `docker-compose.yml` file and update as necessary. Repeat the service block to run multiple containers, for instance for multiple STNP plugins (adjust the port mapping as appropriate!)

## Install Docker Compose

On the Raspberry Pi running Raspian,

```
sudo apt-get install python2.7 python-pip
sudo pip install docker-compose
```

## Edit the `docker-compose.yml`

Some fields you may want to update:

* Environment: specify the name of the STNP plugin(s) you want to run in the container.
* Volumes: specify the path to the `config.json` the container should use.
* Devices: specify the name of the USB serial device on the host to grant to the container.

You can repeat the entire service block to run multiple copies of the container, for instance for additional plugins.

## Bring up the services

Execute `docker-compose up -d` to start the services in the background.

Execute `docker-compose down` to shut them down.

You can also issue the `docker-compose up -d` to update a running container after building a new image or making other changes.

# Run Container Manually

Without Docker Compose, you can manually run a container from a built image.

At a minimum, you will want to specify a port mapping, a value for the `ENABLED_PLUGINS` environment variable, assign a serial device to the container (if using one of the serial-port plugins). Optionally you can specify a useful name for the container:

```
docker run -itd -p 8080:8080 -v ./config.json:/sntp/config.json -e ENABLED_PLUGINS="generic" \
--device /dev/ttyUSB0:/dev/ttyUSB0 smartthings-node-proxy:latest --name smartthings-node-proxy-generic
```

# Using on Other Platforms

This Dockerfile is designed for building and running on a Raspberry Pi. With a couple of modifications this can be modified to build and run on a x64 Linux machine:

* Specify "x64" as the `architecture` build argument.
* Change the `FROM` line from `FROM resin/rpi-raspbian:jessie` to `FROM debian:jessie`
* Change the node download URL on line 20 from `node-v${node_version}-linux-${architecture}l.tar.xz` to `node-v${node_version}-linux-${architecture}.tar.xz`; i.e., remove the "l" from the file name.



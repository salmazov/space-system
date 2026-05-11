#include "SpaceSystemLevelActor.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "HttpModule.h"
#include "IWebSocket.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"
#include "WebSocketsModule.h"

namespace
{
	constexpr float MapScale = 175.0f;
	constexpr float BasicMeshRadius = 50.0f;
	constexpr float BasicMeshHeight = 100.0f;

	FLinearColor PlanetColor(const FString& PlanetId)
	{
		if (PlanetId == TEXT("earth")) return FLinearColor(0.18f, 0.55f, 0.92f);
		if (PlanetId == TEXT("luna")) return FLinearColor(0.72f, 0.77f, 0.82f);
		if (PlanetId == TEXT("mars")) return FLinearColor(0.86f, 0.31f, 0.2f);
		if (PlanetId == TEXT("jupiter")) return FLinearColor(0.82f, 0.52f, 0.26f);
		if (PlanetId == TEXT("saturn")) return FLinearColor(0.88f, 0.72f, 0.38f);
		if (PlanetId == TEXT("uranus")) return FLinearColor(0.3f, 0.82f, 0.78f);
		return FLinearColor(0.42f, 0.7f, 0.82f);
	}

	float PlanetScale(const FString& PlanetId)
	{
		if (PlanetId == TEXT("luna")) return 0.55f;
		if (PlanetId == TEXT("uranus")) return 0.9f;
		return 1.25f;
	}

	FLinearColor ShipColor(const FSpaceSystemShipView& Ship, const FString& ClientId)
	{
		if (Ship.OwnerClientId == ClientId) return FLinearColor(1.0f, 0.12f, 0.1f);
		if (Ship.Faction == TEXT("Union")) return FLinearColor(0.25f, 0.65f, 1.0f);
		if (Ship.Faction == TEXT("Guild")) return FLinearColor(0.95f, 0.22f, 0.16f);
		if (Ship.Faction == TEXT("League")) return FLinearColor(1.0f, 0.62f, 0.22f);
		if (Ship.Faction == TEXT("Compact")) return FLinearColor(0.9f, 0.78f, 0.36f);
		return FLinearColor(0.75f, 0.9f, 1.0f);
	}

	FString PlanetLabel(const FSpaceSystemPlanetView& Planet)
	{
		return FString::Printf(TEXT("%s\n%s"), *Planet.Name, *Planet.Faction);
	}

	float JsonNumber(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, float Fallback = 0.0f)
	{
		double Value = Fallback;
		return Object.IsValid() && Object->TryGetNumberField(FieldName, Value) ? static_cast<float>(Value) : Fallback;
	}

	FString JsonString(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName, const FString& Fallback = FString())
	{
		FString Value;
		return Object.IsValid() && Object->TryGetStringField(FieldName, Value) ? Value : Fallback;
	}

	FVector2D JsonPosition(const TSharedPtr<FJsonObject>& Object)
	{
		return FVector2D(JsonNumber(Object, TEXT("x")), JsonNumber(Object, TEXT("z")));
	}

	TSharedPtr<FJsonObject> JsonObjectField(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName)
	{
		const TSharedPtr<FJsonObject>* Child = nullptr;
		return Object.IsValid() && Object->TryGetObjectField(FieldName, Child) && Child ? *Child : nullptr;
	}

	const TArray<TSharedPtr<FJsonValue>>* JsonArrayField(const TSharedPtr<FJsonObject>& Object, const TCHAR* FieldName)
	{
		const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
		return Object.IsValid() && Object->TryGetArrayField(FieldName, Values) ? Values : nullptr;
	}
}

ASpaceSystemLevelActor::ASpaceSystemLevelActor()
{
	PrimaryActorTick.bCanEverTick = false;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	RootComponent = SceneRoot;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));

	SphereMesh = SphereAsset.Object;
	CubeMesh = CubeAsset.Object;
	CylinderMesh = CylinderAsset.Object;
	BaseMaterial = MaterialAsset.Object;
}

void ASpaceSystemLevelActor::BeginPlay()
{
	Super::BeginPlay();

	BuildPlanetData();
	BuildLighting();
	BuildGrid();
	BuildStars();
	RebuildRefreshableScene();
	ConnectToServer();
}

void ASpaceSystemLevelActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	bAllowReconnect = false;
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(ReconnectTimer);
	}

	if (WorldSocket.IsValid())
	{
		WorldSocket->Close();
		WorldSocket.Reset();
	}

	Super::EndPlay(EndPlayReason);
}

void ASpaceSystemLevelActor::BuildPlanetData()
{
	Planets = {
		{TEXT("earth"), TEXT("Earth"), TEXT("Union"), FVector2D(-10.0f, 0.0f), PlanetColor(TEXT("earth")), PlanetScale(TEXT("earth"))},
		{TEXT("luna"), TEXT("Luna"), TEXT("Union"), FVector2D(-8.7f, 0.9f), PlanetColor(TEXT("luna")), PlanetScale(TEXT("luna"))},
		{TEXT("mars"), TEXT("Mars"), TEXT("Guild"), FVector2D(2.5f, -5.2f), PlanetColor(TEXT("mars")), PlanetScale(TEXT("mars"))},
		{TEXT("jupiter"), TEXT("Jupiter"), TEXT("League"), FVector2D(13.2f, -1.4f), PlanetColor(TEXT("jupiter")), PlanetScale(TEXT("jupiter"))},
		{TEXT("saturn"), TEXT("Saturn"), TEXT("Compact"), FVector2D(26.0f, 5.4f), PlanetColor(TEXT("saturn")), PlanetScale(TEXT("saturn"))},
		{TEXT("uranus"), TEXT("Uranus Fuel Mine"), TEXT("Frontier"), FVector2D(39.0f, -6.2f), PlanetColor(TEXT("uranus")), PlanetScale(TEXT("uranus"))}
	};
}

void ASpaceSystemLevelActor::BuildLighting()
{
	UDirectionalLightComponent* KeyLight = NewObject<UDirectionalLightComponent>(this, TEXT("KeyLight"));
	KeyLight->SetupAttachment(SceneRoot);
	KeyLight->SetRelativeRotation(FRotator(-58.0f, -32.0f, 0.0f));
	KeyLight->SetIntensity(3.2f);
	KeyLight->RegisterComponent();

	USkyLightComponent* SkyLight = NewObject<USkyLightComponent>(this, TEXT("SoftSpaceLight"));
	SkyLight->SetupAttachment(SceneRoot);
	SkyLight->SetIntensity(0.45f);
	SkyLight->RegisterComponent();
}

void ASpaceSystemLevelActor::BuildGrid()
{
	AddMesh(TEXT("SpaceFloor"), CubeMesh, FVector(2500.0f, -150.0f, -12.0f), FVector(92.0f, 34.0f, 0.05f), FLinearColor(0.015f, 0.02f, 0.035f), false);

	for (int32 Index = -18; Index <= 52; Index += 2)
	{
		const float X = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridX_%d"), Index), FVector(X, -1750.0f, 4.0f), FVector(X, 1500.0f, 4.0f), 3.0f, FLinearColor(0.05f, 0.09f, 0.13f), false);
	}

	for (int32 Index = -12; Index <= 10; Index += 2)
	{
		const float Y = Index * MapScale;
		AddCylinderLine(*FString::Printf(TEXT("GridY_%d"), Index), FVector(-2200.0f, Y, 4.0f), FVector(7600.0f, Y, 4.0f), 3.0f, FLinearColor(0.05f, 0.09f, 0.13f), false);
	}

	AddLabel(TEXT("GridCaption"), TEXT("Known trade space"), FVector(-1750.0f, -1450.0f, 120.0f), 54.0f, FColor(145, 178, 196), false);
}

void ASpaceSystemLevelActor::BuildStars()
{
	FRandomStream Stream(3016);
	for (int32 Index = 0; Index < 90; ++Index)
	{
		const FVector Location(
			Stream.FRandRange(-2800.0f, 8400.0f),
			Stream.FRandRange(-2200.0f, 2100.0f),
			Stream.FRandRange(450.0f, 1900.0f));
		const float StarScale = Stream.FRandRange(0.018f, 0.052f);
		AddMesh(*FString::Printf(TEXT("Star_%02d"), Index), SphereMesh, Location, FVector(StarScale), FLinearColor(0.62f, 0.78f, 0.95f), false);
	}
}

void ASpaceSystemLevelActor::RebuildRefreshableScene()
{
	ClearRefreshableScene();
	BuildRoutes();
	BuildPlanets();
	BuildShips();
	BuildStatusBeacon();
}

void ASpaceSystemLevelActor::ClearRefreshableScene()
{
	for (UActorComponent* Component : RefreshableComponents)
	{
		if (Component)
		{
			Component->DestroyComponent();
		}
	}
	RefreshableComponents.Reset();
}

void ASpaceSystemLevelActor::BuildRoutes()
{
	for (int32 Index = 1; Index < Planets.Num(); ++Index)
	{
		AddCylinderLine(
			*FString::Printf(TEXT("TradeRoute_%d"), Index),
			ToWorldPosition(Planets[Index - 1].MapPosition, 24.0f),
			ToWorldPosition(Planets[Index].MapPosition, 24.0f),
			9.0f,
			FLinearColor(0.08f, 0.2f, 0.3f));
	}
}

void ASpaceSystemLevelActor::BuildPlanets()
{
	if (ExploredAreas.Num() > 0)
	{
		for (int32 Index = 0; Index < ExploredAreas.Num(); ++Index)
		{
			const FSpaceSystemExploredAreaView& Area = ExploredAreas[Index];
			AddMesh(*FString::Printf(TEXT("ExploredArea_%d"), Index), CylinderMesh, ToWorldPosition(Area.Center, 2.0f), FVector((Area.Radius * MapScale) / BasicMeshRadius, (Area.Radius * MapScale) / BasicMeshRadius, 0.018f), FLinearColor(0.03f, 0.12f, 0.16f));
		}
	}

	for (const FSpaceSystemPlanetView& Planet : Planets)
	{
		const float Radius = Planet.Scale * 82.0f;
		if (ExploredAreas.Num() == 0)
		{
			AddMesh(*FString::Printf(TEXT("Explored_%s"), *Planet.Id), CylinderMesh, ToWorldPosition(Planet.MapPosition, 2.0f), FVector((Radius * 3.6f) / BasicMeshRadius, (Radius * 3.6f) / BasicMeshRadius, 0.018f), FLinearColor(0.03f, 0.12f, 0.16f));
		}

		AddMesh(*FString::Printf(TEXT("Planet_%s"), *Planet.Id), SphereMesh, ToWorldPosition(Planet.MapPosition, Radius), FVector(Radius / BasicMeshRadius), Planet.Color);
		AddLabel(*FString::Printf(TEXT("Label_%s"), *Planet.Id), PlanetLabel(Planet), ToWorldPosition(Planet.MapPosition, Radius + 175.0f), 58.0f, FColor::White);

		if (Planet.Id == TEXT("saturn"))
		{
			AddMesh(TEXT("SaturnRing"), CylinderMesh, ToWorldPosition(Planet.MapPosition, Radius + 2.0f), FVector((Radius * 2.2f) / BasicMeshRadius, (Radius * 2.2f) / BasicMeshRadius, 0.025f), FLinearColor(0.72f, 0.58f, 0.28f));
		}
	}
}

void ASpaceSystemLevelActor::BuildShips()
{
	if (Ships.Num() == 0 && !bUsingLiveSnapshot)
	{
		FSpaceSystemShipView PreviewShip;
		PreviewShip.Name = TEXT("Surveyor-01");
		PreviewShip.Faction = TEXT("Union");
		PreviewShip.OwnerClientId = ClientId;
		PreviewShip.MapPosition = FVector2D(-9.45f, -0.73f);
		PreviewShip.DestinationMapPosition = FVector2D(2.5f, -5.2f);
		PreviewShip.bHasDestination = true;
		PreviewShip.Fuel = 36.0f;
		PreviewShip.FuelCapacity = 60.0f;
		Ships.Add(PreviewShip);
	}

	for (const FSpaceSystemShipView& Ship : Ships)
	{
		const FVector ShipLocation = ToWorldPosition(Ship.MapPosition, 265.0f);
		if (Ship.bHasDestination)
		{
			AddCylinderLine(*FString::Printf(TEXT("ActiveRoute_%s"), *Ship.Id), ShipLocation, ToWorldPosition(Ship.DestinationMapPosition, 235.0f), 12.0f, ShipColor(Ship, ClientId));
		}

		const bool bOwned = Ship.OwnerClientId == ClientId;
		AddMesh(*FString::Printf(TEXT("Ship_%s"), *Ship.Id), CubeMesh, ShipLocation, bOwned ? FVector(0.42f, 0.28f, 0.18f) : FVector(0.34f, 0.23f, 0.15f), ShipColor(Ship, ClientId));
		AddLabel(
			*FString::Printf(TEXT("ShipLabel_%s"), *Ship.Id),
			FString::Printf(TEXT("%s\n%s\nFuel %.0f/%.0f"), *Ship.Name, *Ship.Faction, Ship.Fuel, Ship.FuelCapacity),
			ShipLocation + FVector(0.0f, 0.0f, 155.0f),
			48.0f,
			bOwned ? FColor(255, 204, 204) : FColor(214, 234, 255));
	}
}

void ASpaceSystemLevelActor::BuildStatusBeacon()
{
	AddLabel(
		TEXT("StatusBeacon"),
		FString::Printf(TEXT("Space System\n%s\nTick %d, planets %d, ships %d"), *ConnectionStatus, WorldTick, Planets.Num(), Ships.Num()),
		FVector(-1550.0f, -1200.0f, 360.0f),
		52.0f,
		FColor(178, 226, 255));
}

void ASpaceSystemLevelActor::ConnectToServer()
{
	if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
	{
		FModuleManager::LoadModuleChecked<FWebSocketsModule>(TEXT("WebSockets"));
	}

	ConnectionStatus = FString::Printf(TEXT("connecting to %s"), *ServerHttpBaseUrl);
	RebuildRefreshableScene();

	WorldSocket = FWebSocketsModule::Get().CreateWebSocket(ServerWebSocketUrl);
	WorldSocket->OnConnected().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketConnected);
	WorldSocket->OnConnectionError().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketConnectionError);
	WorldSocket->OnClosed().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketClosed);
	WorldSocket->OnMessage().AddUObject(this, &ASpaceSystemLevelActor::HandleSocketMessage);
	WorldSocket->Connect();
}

void ASpaceSystemLevelActor::ScheduleReconnect()
{
	if (!bAllowReconnect)
	{
		return;
	}

	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().SetTimer(ReconnectTimer, this, &ASpaceSystemLevelActor::ConnectToServer, 2.0f, false);
	}
}

void ASpaceSystemLevelActor::HandleSocketConnected()
{
	ConnectionStatus = FString::Printf(TEXT("connected to %s"), *ServerHttpBaseUrl);
	RebuildRefreshableScene();
}

void ASpaceSystemLevelActor::HandleSocketConnectionError(const FString& Error)
{
	ConnectionStatus = FString::Printf(TEXT("server connection failed: %s"), *Error);
	RebuildRefreshableScene();
	ScheduleReconnect();
}

void ASpaceSystemLevelActor::HandleSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean)
{
	ConnectionStatus = FString::Printf(TEXT("server disconnected: %s"), Reason.IsEmpty() ? TEXT("closed") : *Reason);
	RebuildRefreshableScene();
	ScheduleReconnect();
}

void ASpaceSystemLevelActor::HandleSocketMessage(const FString& Message)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return;
	}

	if (JsonString(Root, TEXT("type")) != TEXT("world"))
	{
		return;
	}

	ApplyWorldPayload(JsonObjectField(Root, TEXT("payload")));
}

void ASpaceSystemLevelActor::ApplyWorldPayload(const TSharedPtr<FJsonObject>& Payload)
{
	if (!Payload.IsValid())
	{
		return;
	}

	bUsingLiveSnapshot = true;
	WorldTick = static_cast<int32>(JsonNumber(Payload, TEXT("tick"), WorldTick));
	Planets.Reset();
	Ships.Reset();
	ExploredAreas.Reset();

	if (const TArray<TSharedPtr<FJsonValue>>* PlanetValues = JsonArrayField(Payload, TEXT("planets")))
	{
		for (const TSharedPtr<FJsonValue>& PlanetValue : *PlanetValues)
		{
			const TSharedPtr<FJsonObject> PlanetObject = PlanetValue->AsObject();
			const FString PlanetId = JsonString(PlanetObject, TEXT("id"));
			if (PlanetId.IsEmpty())
			{
				continue;
			}

			FSpaceSystemPlanetView Planet;
			Planet.Id = PlanetId;
			Planet.Name = JsonString(PlanetObject, TEXT("name"), PlanetId);
			Planet.Faction = JsonString(PlanetObject, TEXT("faction"));
			Planet.MapPosition = JsonPosition(JsonObjectField(PlanetObject, TEXT("position")));
			Planet.Color = PlanetColor(PlanetId);
			Planet.Scale = PlanetScale(PlanetId);
			Planets.Add(Planet);
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* PlayerValues = JsonArrayField(Payload, TEXT("players")))
	{
		for (const TSharedPtr<FJsonValue>& PlayerValue : *PlayerValues)
		{
			const TSharedPtr<FJsonObject> PlayerObject = PlayerValue->AsObject();
			FSpaceSystemShipView Ship;
			Ship.Id = JsonString(PlayerObject, TEXT("id"), FString::Printf(TEXT("ship-%d"), Ships.Num() + 1));
			Ship.Name = JsonString(PlayerObject, TEXT("name"), Ship.Id);
			Ship.Faction = JsonString(PlayerObject, TEXT("faction"));
			Ship.OwnerClientId = JsonString(PlayerObject, TEXT("ownerClientId"));
			Ship.DestinationPlanetId = JsonString(PlayerObject, TEXT("destinationPlanetId"));
			Ship.MapPosition = JsonPosition(JsonObjectField(PlayerObject, TEXT("position")));
			Ship.Fuel = JsonNumber(PlayerObject, TEXT("fuel"));
			Ship.FuelCapacity = FMath::Max(1.0f, JsonNumber(PlayerObject, TEXT("fuelCapacity"), 1.0f));

			if (const TSharedPtr<FJsonObject> Destination = JsonObjectField(PlayerObject, TEXT("destinationPosition")))
			{
				Ship.DestinationMapPosition = JsonPosition(Destination);
				Ship.bHasDestination = true;
			}
			else if (const FSpaceSystemPlanetView* DestinationPlanet = PlanetById(Ship.DestinationPlanetId))
			{
				Ship.DestinationMapPosition = DestinationPlanet->MapPosition;
				Ship.bHasDestination = true;
			}

			if (Ship.OwnerClientId == ClientId)
			{
				if (const TArray<TSharedPtr<FJsonValue>>* ExploredValues = JsonArrayField(PlayerObject, TEXT("exploredAreas")))
				{
					for (const TSharedPtr<FJsonValue>& AreaValue : *ExploredValues)
					{
						const TSharedPtr<FJsonObject> AreaObject = AreaValue->AsObject();
						FSpaceSystemExploredAreaView Area;
						Area.Center = JsonPosition(JsonObjectField(AreaObject, TEXT("center")));
						Area.Radius = JsonNumber(AreaObject, TEXT("radius"), 1.0f);
						ExploredAreas.Add(Area);
					}
				}
			}

			Ships.Add(Ship);
		}
	}

	ConnectionStatus = FString::Printf(TEXT("connected to %s"), *ServerHttpBaseUrl);
	RequestSpawnIfNeeded(Payload);
	RebuildRefreshableScene();
}

void ASpaceSystemLevelActor::RequestSpawnIfNeeded(const TSharedPtr<FJsonObject>& Payload)
{
	if (bSpawnRequested || !Payload.IsValid() || Planets.Num() == 0)
	{
		return;
	}

	for (const FSpaceSystemShipView& Ship : Ships)
	{
		if (Ship.OwnerClientId == ClientId)
		{
			return;
		}
	}

	if (const TArray<TSharedPtr<FJsonValue>>* PendingValues = JsonArrayField(Payload, TEXT("pendingActions")))
	{
		for (const TSharedPtr<FJsonValue>& PendingValue : *PendingValues)
		{
			const TSharedPtr<FJsonObject> PendingAction = JsonObjectField(PendingValue->AsObject(), TEXT("action"));
			if (JsonString(PendingAction, TEXT("clientId")) == ClientId && JsonString(PendingAction, TEXT("action")) == TEXT("spawn"))
			{
				return;
			}
		}
	}

	bSpawnRequested = true;
	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("action"), TEXT("spawn"));
	Body->SetStringField(TEXT("clientId"), ClientId);
	Body->SetStringField(TEXT("shipClassId"), TEXT("small_trade_ship"));
	Body->SetStringField(TEXT("target"), Planets[0].Id);
	Body->SetStringField(TEXT("name"), PilotName);

	FString BodyString;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyString);
	FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(ServerHttpBaseUrl / TEXT("actions"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(BodyString);
	Request->OnProcessRequestComplete().BindUObject(this, &ASpaceSystemLevelActor::HandleSpawnResponse);
	Request->ProcessRequest();
}

void ASpaceSystemLevelActor::HandleSpawnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully)
{
	if (!bConnectedSuccessfully || !Response.IsValid() || Response->GetResponseCode() >= 400)
	{
		bSpawnRequested = false;
	}
}

FVector ASpaceSystemLevelActor::ToWorldPosition(const FVector2D& MapPosition, float Height) const
{
	return FVector(MapPosition.X * MapScale, MapPosition.Y * MapScale, Height);
}

UMaterialInstanceDynamic* ASpaceSystemLevelActor::CreateColorMaterial(const FLinearColor& Color, FName Name)
{
	UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(BaseMaterial, this, Name);
	if (Material)
	{
		Material->SetVectorParameterValue(TEXT("Color"), Color);
		Material->SetVectorParameterValue(TEXT("BaseColor"), Color);
	}
	return Material;
}

UStaticMeshComponent* ASpaceSystemLevelActor::AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bRefreshable)
{
	UStaticMeshComponent* Component = NewObject<UStaticMeshComponent>(this, Name);
	Component->SetupAttachment(SceneRoot);
	Component->SetStaticMesh(Mesh);
	Component->SetWorldLocation(Location);
	Component->SetWorldScale3D(Scale);
	Component->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Component->SetMaterial(0, CreateColorMaterial(Color, FName(*FString::Printf(TEXT("%s_Material"), *Name.ToString()))));
	AddInstanceComponent(Component);
	Component->RegisterComponent();

	if (bRefreshable)
	{
		RefreshableComponents.Add(Component);
	}
	return Component;
}

UTextRenderComponent* ASpaceSystemLevelActor::AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color, bool bRefreshable)
{
	UTextRenderComponent* Label = NewObject<UTextRenderComponent>(this, Name);
	Label->SetupAttachment(SceneRoot);
	Label->SetWorldLocation(Location);
	Label->SetWorldRotation(FRotator(62.0f, 0.0f, 0.0f));
	Label->SetText(FText::FromString(Text));
	Label->SetTextRenderColor(Color);
	Label->SetHorizontalAlignment(EHTA_Center);
	Label->SetWorldSize(Size);
	AddInstanceComponent(Label);
	Label->RegisterComponent();

	if (bRefreshable)
	{
		RefreshableComponents.Add(Label);
	}
	return Label;
}

void ASpaceSystemLevelActor::AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color, bool bRefreshable)
{
	const FVector Delta = End - Start;
	const float Length = Delta.Size();
	if (Length <= KINDA_SMALL_NUMBER)
	{
		return;
	}

	UStaticMeshComponent* Line = AddMesh(Name, CylinderMesh, Start + Delta * 0.5f, FVector(Radius / BasicMeshRadius, Radius / BasicMeshRadius, Length / BasicMeshHeight), Color, bRefreshable);
	Line->SetWorldRotation(FRotationMatrix::MakeFromZ(Delta).Rotator());
}

const FSpaceSystemPlanetView* ASpaceSystemLevelActor::PlanetById(const FString& PlanetId) const
{
	return Planets.FindByPredicate([&PlanetId](const FSpaceSystemPlanetView& Planet) {
		return Planet.Id == PlanetId;
	});
}